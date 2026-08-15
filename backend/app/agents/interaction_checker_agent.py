"""InteractionCheckerAgent — detects drug-food interactions based on structured KB.

Matches patient medications and proposed food items against:
  1. `data/clean/drug_products.json` — resolves commercial drug names → activeKey
  2. `data/clean/drug_rules.json` — clinical safety rules per activeKey
  3. `backend/data/drug_food_interactions.json` — legacy food-specific interaction KB

Uses unidecode / accent normalization and alias mapping.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

try:
    from unidecode import unidecode
except ImportError:
    def unidecode(text: str) -> str:
        return text

from app.schemas.meal_plan import (
    InteractionCheckInput,
    InteractionCheckOutput,
    InteractionItem,
)

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent  # P-014/

# ── Data paths ────────────────────────────────────────────────────────
_KB_PATH = _BACKEND_DIR / "data" / "drug_food_interactions.json"
_DRUG_PRODUCTS_PATH = _PROJECT_ROOT / "data" / "clean" / "drug_products.json"
_DRUG_RULES_PATH = _PROJECT_ROOT / "data" / "clean" / "drug_rules.json"

# ── Caches ────────────────────────────────────────────────────────────
_cached_kb: list[dict] | None = None
_cached_products: list[dict] | None = None
_cached_rules: list[dict] | None = None


# =====================================================================
# Data Loaders
# =====================================================================

def load_interaction_kb() -> list[dict]:
    """Load the legacy drug-food interaction knowledge base."""
    global _cached_kb
    if _cached_kb is not None:
        return _cached_kb

    if not _KB_PATH.exists():
        logger.warning("Interaction KB file not found at %s", _KB_PATH)
        return []

    try:
        with open(_KB_PATH, encoding="utf-8") as f:
            _cached_kb = json.load(f)
        logger.info("Loaded %d drug-food interaction rules", len(_cached_kb))
        return _cached_kb
    except Exception as e:
        logger.error("Failed to load interaction KB: %s", e)
        return []


def _load_drug_products() -> list[dict]:
    """Load drug_products.json — 434 commercial drug product entries.

    Each entry maps a commercial product name (e.g. 'Medi Gluphag 500')
    to its active ingredient key (e.g. 'METFORMIN') via the `activeKey` field.
    """
    global _cached_products
    if _cached_products is not None:
        return _cached_products

    if not _DRUG_PRODUCTS_PATH.exists():
        logger.warning("drug_products.json not found at %s", _DRUG_PRODUCTS_PATH)
        return []

    try:
        with open(_DRUG_PRODUCTS_PATH, encoding="utf-8") as f:
            _cached_products = json.load(f)
        logger.info("Loaded %d drug products", len(_cached_products))
        return _cached_products
    except Exception as e:
        logger.error("Failed to load drug_products.json: %s", e)
        return []


def _load_drug_rules() -> list[dict]:
    """Load drug_rules.json — 49 clinical safety rules.

    Each rule provides meal timing, hypoglycemia risk, carbohydrate constraints,
    and AI trigger logic for a given activeKey.
    """
    global _cached_rules
    if _cached_rules is not None:
        return _cached_rules

    if not _DRUG_RULES_PATH.exists():
        logger.warning("drug_rules.json not found at %s", _DRUG_RULES_PATH)
        return []

    try:
        with open(_DRUG_RULES_PATH, encoding="utf-8") as f:
            _cached_rules = json.load(f)
        logger.info("Loaded %d drug rules", len(_cached_rules))
        return _cached_rules
    except Exception as e:
        logger.error("Failed to load drug_rules.json: %s", e)
        return []


# =====================================================================
# Normalization & Matching Utilities
# =====================================================================

def _normalize(text: str) -> str:
    """Normalize string by lowercasing and removing accents for comparison."""
    return unidecode(text.lower().strip())


def _match_term(term: str, target: str, aliases: list[str]) -> bool:
    """Check if term matches target or any alias (accent-insensitive)."""
    norm_term = _normalize(term)
    norm_target = _normalize(target)

    if norm_target in norm_term or norm_term in norm_target:
        return True

    for alias in aliases:
        norm_alias = _normalize(alias)
        if norm_alias in norm_term or norm_term in norm_alias:
            return True

    return False


# =====================================================================
# Drug Resolution: Commercial Name → Active Ingredient Key
# =====================================================================

def resolve_medication(med_name: str) -> dict | None:
    """Resolve a medication name (commercial or generic) to its drug product entry.

    Lookup strategy (ordered by priority):
    1. Exact match on `normalizedName`
    2. Fuzzy substring match on `productName` or `aliases`
    3. Direct match on `activeKey` or `activeIngredientText` (for generic names)

    Returns:
        The matching drug product dict, or None if no match found.
    """
    products = _load_drug_products()
    if not products:
        return None

    norm_med = _normalize(med_name)

    # 1. Exact match on normalizedName
    for product in products:
        if product.get("normalizedName", "") == norm_med:
            return product

    # 2. Fuzzy match on productName / aliases
    for product in products:
        product_name = product.get("productName", "")
        aliases = product.get("aliases", [])
        if _match_term(med_name, product_name, aliases):
            return product

    # 3. Match on activeKey or activeIngredientText (generic name lookup)
    for product in products:
        active_key = product.get("activeKey", "")
        active_text = product.get("activeIngredientText", "")
        if _normalize(active_key) == norm_med or _normalize(active_text) == norm_med:
            return product

    return None


def get_clinical_rule(active_key: str, rule_id: str | None = None) -> dict | None:
    """Get the clinical safety rule for a given activeKey.

    Args:
        active_key: The active ingredient key (e.g. 'METFORMIN').
        rule_id: Optional specific ruleId to match (for formulation-specific rules).

    Returns:
        The matching drug rule dict, or None if not found.
    """
    rules = _load_drug_rules()
    if not rules:
        return None

    # If specific ruleId provided, use it
    if rule_id:
        for rule in rules:
            if rule.get("ruleId") == rule_id:
                return rule

    # Otherwise find by activeKey (return first active match)
    for rule in rules:
        if rule.get("activeKey") == active_key and rule.get("isActive", False):
            return rule

    return None


# =====================================================================
# Core Interaction Checking
# =====================================================================

def check_interactions(
    medications: list[str],
    foods: list[str],
) -> list[InteractionItem]:
    """Check interactions between a list of medications and foods.

    Enhanced flow:
    1. Resolve each medication name → activeKey via drug_products.json
    2. Fetch clinical rule from drug_rules.json (meal timing, safety warnings)
    3. Match against legacy drug_food_interactions.json KB for food-specific alerts
    4. Enrich results with clinical metadata

    Args:
        medications: List of drug names — supports both commercial names
                     (e.g. 'Medi Gluphag 500') and generic names (e.g. 'metformin').
        foods: List of food names/ingredients (e.g. ['rượu', 'cơm trắng']).

    Returns:
        List of matching InteractionItem objects with clinical enrichment.
    """
    kb = load_interaction_kb()
    if not medications:
        return []

    results: list[InteractionItem] = []
    seen_keys: set[tuple[str, str]] = set()

    for med in medications:
        if not med:
            continue

        # ── Step 1: Resolve medication → activeKey ────────────────
        product = resolve_medication(med)
        active_key = product.get("activeKey", "") if product else ""
        rule_id = product.get("ruleId") if product else None
        resolved_name = product.get("activeIngredientText", med) if product else med

        if product:
            logger.info(
                "Resolved '%s' → activeKey=%s (product=%s)",
                med, active_key, product.get("productName", "")
            )

        # ── Step 2: Get clinical safety rule ──────────────────────
        clinical_rule = get_clinical_rule(active_key, rule_id) if active_key else None

        # Extract clinical metadata for enrichment
        drug_class = product.get("drugClass", "") if product else ""
        meal_timing = ""
        hypoglycemia_risk = ""
        ai_warning = ""

        if clinical_rule:
            mt = clinical_rule.get("mealTiming", {})
            meal_timing = mt.get("instructionVi", "")
            safety = clinical_rule.get("safety", {})
            hypoglycemia_risk = safety.get("hypoglycemiaRisk", "")
            ai_warning = safety.get("aiWarningVi", "")

        # ── Step 3: Match against legacy food interaction KB ──────
        if foods and kb:
            for food in foods:
                if not food:
                    continue

                for entry in kb:
                    drug_name = entry.get("drug", "")
                    drug_aliases = entry.get("drug_aliases", [])
                    food_name = entry.get("food", "")
                    food_aliases = entry.get("food_aliases", [])

                    # Match using both original med name AND resolved generic name
                    drug_matched = (
                        _match_term(med, drug_name, drug_aliases)
                        or _match_term(resolved_name, drug_name, drug_aliases)
                    )

                    if drug_matched and _match_term(food, food_name, food_aliases):
                        key = (drug_name.lower(), food_name.lower())
                        if key not in seen_keys:
                            seen_keys.add(key)
                            results.append(
                                InteractionItem(
                                    drug=entry.get("drug", med),
                                    food=entry.get("food", food),
                                    mechanism=entry.get("mechanism", ""),
                                    severity=entry.get("severity", "Cần chú ý"),
                                    recommendation=entry.get("recommendation", ""),
                                    sources=entry.get("sources", []),
                                    # Clinical enrichment
                                    drug_class=drug_class or None,
                                    meal_timing=meal_timing or None,
                                    hypoglycemia_risk=hypoglycemia_risk or None,
                                    ai_warning=ai_warning or None,
                                )
                            )

        # ── Step 4: Add clinical-only warning if HIGH risk ────────
        #     Even without a food-specific interaction, if the drug has
        #     HIGH hypoglycemia risk, emit a general safety warning.
        if clinical_rule and hypoglycemia_risk == "HIGH":
            safety_key = (active_key.lower(), "__clinical_safety__")
            if safety_key not in seen_keys:
                seen_keys.add(safety_key)
                carb_rule = clinical_rule.get("carbohydrateRule", {})
                results.append(
                    InteractionItem(
                        drug=resolved_name,
                        food="[Cảnh báo chung về bữa ăn]",
                        mechanism=carb_rule.get("constraintsVi", ""),
                        severity="Nguy hiểm — Nguy cơ hạ đường huyết CAO",
                        recommendation=meal_timing,
                        sources=(
                            clinical_rule.get("sources", {}).get("guideline", [])
                            + clinical_rule.get("sources", {}).get("interaction", [])
                        ),
                        drug_class=drug_class or None,
                        meal_timing=meal_timing or None,
                        hypoglycemia_risk=hypoglycemia_risk or None,
                        ai_warning=ai_warning or None,
                    )
                )

    return results


def interaction_checker_agent(input_data: InteractionCheckInput) -> InteractionCheckOutput:
    """Main entry point for InteractionCheckerAgent.

    Args:
        input_data: InteractionCheckInput with medications, foods, and optional profile_user_id.

    Returns:
        InteractionCheckOutput with matching interactions.
    """
    items = check_interactions(
        medications=input_data.medications,
        foods=input_data.foods,
    )
    return InteractionCheckOutput(interactions=items)

