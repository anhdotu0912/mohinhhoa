"""InteractionCheckerAgent — detects drug-food interactions based on structured KB.

Matches patient medications and proposed food items against `backend/data/drug_food_interactions.json`.
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
_KB_PATH = _BACKEND_DIR / "data" / "drug_food_interactions.json"

_cached_kb: list[dict] | None = None


def load_interaction_kb() -> list[dict]:
    """Load the drug-food interaction knowledge base."""
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


def check_interactions(
    medications: list[str],
    foods: list[str],
) -> list[InteractionItem]:
    """Check interactions between a list of medications and foods.

    Args:
        medications: List of drug names (e.g. ["warfarin", "metformin"]).
        foods: List of food names/ingredients (e.g. ["rau muống", "cơm trắng"]).

    Returns:
        List of matching InteractionItem objects.
    """
    kb = load_interaction_kb()
    if not kb or not medications or not foods:
        return []

    results: list[InteractionItem] = []
    seen_keys: set[tuple[str, str]] = set()

    for med in medications:
        if not med:
            continue
        for food in foods:
            if not food:
                continue

            for entry in kb:
                drug_name = entry.get("drug", "")
                drug_aliases = entry.get("drug_aliases", [])
                food_name = entry.get("food", "")
                food_aliases = entry.get("food_aliases", [])

                # Match drug AND food
                if _match_term(med, drug_name, drug_aliases) and _match_term(food, food_name, food_aliases):
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
