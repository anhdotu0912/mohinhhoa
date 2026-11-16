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
import re
from pathlib import Path

from sqlalchemy.orm import Session

try:
    from unidecode import unidecode
except ImportError:
    def unidecode(text: str) -> str:
        return text

from app.schemas.meal_plan import (
    InteractionCheckInput,
    InteractionCheckOutput,
    InteractionItem,
    UnmatchedPair,
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


def _product_row_to_dict(row) -> dict:
    return {
        "productId": row.id,
        "productName": row.product_name,
        "normalizedName": row.normalized_name,
        "aliases": row.aliases or [],
        "activeIngredientText": row.active_ingredient_text,
        "activeKey": row.active_key,
        "drugClass": row.drug_class,
        "formulationProfile": row.formulation_profile,
        "ruleId": row.rule_id,
        "sources": row.sources or {},
        "isActive": row.is_active,
    }


def _rule_row_to_dict(row) -> dict:
    return {
        "ruleId": row.id,
        "version": row.version,
        "activeKey": row.active_key,
        "activeIngredients": row.active_ingredients or [],
        "drugClass": row.drug_class,
        "formulationProfile": row.formulation_profile,
        "applicableDiabetesTypes": row.applicable_diabetes_types or [],
        "diabetesApplicability": row.diabetes_applicability or {},
        "mealTiming": row.meal_timing or {},
        "carbohydrateRule": row.carbohydrate_rule or {},
        "safety": row.safety or {},
        "sources": row.sources or {},
        "isActive": row.is_active,
    }


def _load_drug_products_from_db(db: Session) -> list[dict]:
    from app.models.nutrition_catalog import DrugProduct

    rows = db.query(DrugProduct).all()
    if not rows:
        return []
    return [_product_row_to_dict(row) for row in rows]


def _load_drug_rules_from_db(db: Session) -> list[dict]:
    from app.models.nutrition_catalog import DrugRule

    rows = db.query(DrugRule).all()
    if not rows:
        return []
    return [_rule_row_to_dict(row) for row in rows]


def _load_drug_products(db: Session | None = None) -> list[dict]:
    """Load drug products from Postgres when available, else JSON file."""
    if db is not None:
        products = _load_drug_products_from_db(db)
        if products:
            logger.info("Loaded %d drug products from DB", len(products))
            return products

    global _cached_products
    if _cached_products is not None:
        return _cached_products

    if not _DRUG_PRODUCTS_PATH.exists():
        logger.warning("drug_products.json not found at %s", _DRUG_PRODUCTS_PATH)
        return []

    try:
        with open(_DRUG_PRODUCTS_PATH, encoding="utf-8") as f:
            _cached_products = json.load(f)
        logger.info("Loaded %d drug products from JSON", len(_cached_products))
        return _cached_products
    except Exception as e:
        logger.error("Failed to load drug_products.json: %s", e)
        return []


def _load_drug_rules(db: Session | None = None) -> list[dict]:
    """Load drug rules from Postgres when available, else JSON file."""
    if db is not None:
        rules = _load_drug_rules_from_db(db)
        if rules:
            logger.info("Loaded %d drug rules from DB", len(rules))
            return rules

    global _cached_rules
    if _cached_rules is not None:
        return _cached_rules

    if not _DRUG_RULES_PATH.exists():
        logger.warning("drug_rules.json not found at %s", _DRUG_RULES_PATH)
        return []

    try:
        with open(_DRUG_RULES_PATH, encoding="utf-8") as f:
            _cached_rules = json.load(f)
        logger.info("Loaded %d drug rules from JSON", len(_cached_rules))
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
# Food Extraction from User Query
# =====================================================================

_DEFAULT_INTERACTION_FOODS = [
    "bưởi",
    "rượu",
    "bia",
    "đường tinh luyện",
    "mướp đắng",
    "chuối",
    "muối",
]

_STOP_WORDS_FOOD = {
    "gì", "nào", "gì không", "sao không", "được không", "không", "thì sao", "được",
    "thuốc", "viên", "bệnh", "tiểu đường", "đái tháo đường", "kỵ", "kiêng", "kị",
    "tương tác", "tác dụng phụ", "bị", "đang", "dùng", "uống", "ăn", "với", "cùng",
    "khi", "có", "nên", "thì", "là", "và", "metformin", "glipizide", "sitagliptin",
    "atorvastatin", "insulin", "gliclazide", "empagliflozin", "lisinopril", "amlodipine",
    "tôi", "em", "anh", "chị", "bác sĩ", "cho", "hỏi", "với", "ạ",
    # Common OTC drug names outside the diabetes/cardio KB scope — not resolvable via
    # resolve_medication(), so without this they leak into the extracted "food" string.
    "panadol", "paracetamol", "efferalgan", "aspirin", "ibuprofen",
}


def extract_foods_from_message(
    message: str,
    medications: list[str] | None = None,
) -> tuple[list[str], bool]:
    """Extract food items mentioned in user message.

    Args:
        medications: patient's actual medication names (e.g. from profile). Filtered
            out of the extracted candidate on top of the static stop-word list, since
            a drug not in that hardcoded set (e.g. "panadol") would otherwise leak
            into the "food" string and get treated as part of the dish name.

    Returns:
        (foods_list, is_specific_query)
        - is_specific_query: True if the user asks about specific food(s).
        - is_specific_query: False if it's a general inquiry (e.g., "Metformin kiêng gì?").
    """
    from app.core.chat_text import normalize_chat_text, trim_meal_context

    message_lower = normalize_chat_text(message)
    kb = load_interaction_kb()
    stop_words = _STOP_WORDS_FOOD | {m.lower().strip() for m in (medications or []) if m}

    # 1. Match against known KB foods & aliases
    matched_kb: list[str] = []
    if kb:
        all_food_entries = []
        for entry in kb:
            food_name = entry.get("food", "")
            aliases = entry.get("food_aliases", [])
            for name in [food_name] + aliases:
                if name:
                    all_food_entries.append((name, food_name))

        all_food_entries.sort(key=lambda x: len(x[0]), reverse=True)

        for alias, canonical_food in all_food_entries:
            if alias.lower() in message_lower:
                if canonical_food not in matched_kb:
                    matched_kb.append(canonical_food)

    if matched_kb:
        return matched_kb, True

    # 2. Extract food phrase using Vietnamese query patterns
    patterns = [
        r"(?:có\s+)?(?:ăn|uống|dùng)\s+([^?.,!]+?)(?:\s+(?:được\s+không|có\s+được\s+không|có\s+sao\s+không|khi|đang|với|cùng|không|\?|$))",
        r"([^?.,!\s]+(?:\s+[^?.,!\s]+){0,3})\s+(?:có\s+ăn\s+được\s+không|ăn\s+được\s+không|uống\s+được\s+không)",
    ]

    extracted_candidates: list[str] = []
    for pat in patterns:
        matches = re.findall(pat, message_lower)
        for m in matches:
            candidate = trim_meal_context(m.strip())
            words = candidate.split()
            filtered_words = [w for w in words if w not in stop_words]
            clean_candidate = " ".join(filtered_words).strip()
            if clean_candidate and len(clean_candidate) >= 2 and clean_candidate not in extracted_candidates:
                extracted_candidates.append(clean_candidate)

    if extracted_candidates:
        return extracted_candidates, True

    # 3. If no specific food is identified in message, return empty list without fabricating default items
    return [], False


def get_medication_known_interactions(
    medications: list[str],
    db: Session | None = None,
) -> list[InteractionItem]:
    """Retrieve all known drug-food interactions in KB for given medications."""
    kb = load_interaction_kb()
    if not medications or not kb:
        return []

    results: list[InteractionItem] = []
    seen_keys: set[tuple[str, str]] = set()

    for med in medications:
        if not med:
            continue
        product = resolve_medication(med, db=db)
        active_key = product.get("activeKey", "") if product else ""
        rule_id = product.get("ruleId") if product else None
        resolved_name = product.get("activeIngredientText", med) if product else med

        clinical_rule = get_clinical_rule(active_key, rule_id, db=db) if active_key else None
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

        for entry in kb:
            drug_name = entry.get("drug", "")
            drug_aliases = entry.get("drug_aliases", [])
            food_name = entry.get("food", "")

            drug_matched = (
                _match_term(med, drug_name, drug_aliases)
                or _match_term(resolved_name, drug_name, drug_aliases)
            )

            if drug_matched:
                key = (drug_name.lower(), food_name.lower())
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append(
                        InteractionItem(
                            drug=entry.get("drug", med),
                            food=entry.get("food", food_name),
                            mechanism=entry.get("mechanism", ""),
                            severity=entry.get("severity", "Cần chú ý"),
                            recommendation=entry.get("recommendation", ""),
                            sources=entry.get("sources", []),
                            drug_class=drug_class or None,
                            meal_timing=meal_timing or None,
                            hypoglycemia_risk=hypoglycemia_risk or None,
                            ai_warning=ai_warning or None,
                        )
                    )

    return results


# =====================================================================
# Drug Resolution: Commercial Name → Active Ingredient Key
# =====================================================================

def resolve_medication(med_name: str, db: Session | None = None) -> dict | None:
    """Resolve a medication name (commercial or generic) to its drug product entry.

    Lookup strategy (ordered by priority):
    1. Exact match on `normalizedName`
    2. Fuzzy substring match on `productName` or `aliases`
    3. Direct match on `activeKey` or `activeIngredientText` (for generic names)

    Returns:
        The matching drug product dict, or None if no match found.
    """
    products = _load_drug_products(db)
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


def get_clinical_rule(
    active_key: str,
    rule_id: str | None = None,
    db: Session | None = None,
) -> dict | None:
    """Get the clinical safety rule for a given activeKey.

    Args:
        active_key: The active ingredient key (e.g. 'METFORMIN').
        rule_id: Optional specific ruleId to match (for formulation-specific rules).

    Returns:
        The matching drug rule dict, or None if not found.
    """
    rules = _load_drug_rules(db)
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
    db: Session | None = None,
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
        product = resolve_medication(med, db=db)
        active_key = product.get("activeKey", "") if product else ""
        rule_id = product.get("ruleId") if product else None
        resolved_name = product.get("activeIngredientText", med) if product else med

        if product:
            logger.info(
                "Resolved '%s' → activeKey=%s (product=%s)",
                med, active_key, product.get("productName", "")
            )

        # ── Step 2: Get clinical safety rule ──────────────────────
        clinical_rule = get_clinical_rule(active_key, rule_id, db=db) if active_key else None

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


def _pair_matches_kb(
    med: str,
    food: str,
    kb: list[dict],
    db: Session | None = None,
) -> bool:
    """Return True if drug×food pair has a legacy KB entry."""
    if not med or not food or not kb:
        return False

    product = resolve_medication(med, db=db)
    resolved_name = product.get("activeIngredientText", med) if product else med

    for entry in kb:
        drug_name = entry.get("drug", "")
        drug_aliases = entry.get("drug_aliases", [])
        food_name = entry.get("food", "")
        food_aliases = entry.get("food_aliases", [])

        drug_matched = (
            _match_term(med, drug_name, drug_aliases)
            or _match_term(resolved_name, drug_name, drug_aliases)
        )
        if drug_matched and _match_term(food, food_name, food_aliases):
            return True
    return False


def compute_unmatched_pairs(
    medications: list[str],
    foods: list[str],
    db: Session | None = None,
) -> list[UnmatchedPair]:
    """List drug×food input pairs with no KB match."""
    kb = load_interaction_kb()
    unmatched: list[UnmatchedPair] = []
    for med in medications:
        if not med:
            continue
        for food in foods:
            if not food:
                continue
            if not _pair_matches_kb(med, food, kb, db=db):
                unmatched.append(UnmatchedPair(drug=med, food=food))
    return unmatched


def interaction_checker_agent(
    input_data: InteractionCheckInput,
    db: Session | None = None,
) -> InteractionCheckOutput:
    """Main entry point for InteractionCheckerAgent.

    Args:
        input_data: InteractionCheckInput with medications, foods, and optional profile_user_id.

    Returns:
        InteractionCheckOutput with matching interactions.
    """
    items = check_interactions(
        medications=input_data.medications,
        foods=input_data.foods,
        db=db,
    )
    unmatched = compute_unmatched_pairs(
        medications=input_data.medications,
        foods=input_data.foods,
        db=db,
    )
    return InteractionCheckOutput(interactions=items, unmatched_pairs=unmatched)

