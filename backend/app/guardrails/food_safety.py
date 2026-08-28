"""Deterministic Food Safety Guardrail — Tier-2 Post-Generation Safety Filter.

Scans LLM-generated output for mentioned foods and cross-references against:
1. Patient's active medications (using legacy drug_food_interactions.json and drug_rules.json)
2. Patient's registered allergies (using _ALLERGY_FOOD_MAP)

If a severe/caution drug-food interaction or allergy risk is detected, injects a targeted medical footnote.
If no conflicts exist, keeps the output clean without unneeded medication/allergy noise.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.agents.interaction_checker_agent import (
    get_medication_known_interactions,
    load_interaction_kb,
)
from app.agents.skills.primitive_skills import _ALLERGY_FOOD_MAP

logger = logging.getLogger(__name__)


def _match_word_in_text(term: str, text: str) -> bool:
    """Match whole term in text, ensuring no partial word substring match."""
    term_clean = term.strip().lower()
    if not term_clean:
        return False
    pattern = rf"(?:^|[^\w\u00C0-\u1EF9]){re.escape(term_clean)}(?:$|[^\w\u00C0-\u1EF9])"
    return bool(re.search(pattern, text.lower()))


def enforce_food_safety_guardrail(
    answer: str,
    medications: list[str] | None = None,
    allergies: list[str] | None = None,
    db: Session | None = None,
) -> tuple[str, list[str]]:
    """Inspect generated text for food mentions that conflict with patient's medications or allergies.

    Returns:
        tuple of (updated_answer, guardrail_flags)
    """
    if not answer or (not medications and not allergies):
        return answer, []

    medications = medications or []
    allergies = allergies or []
    flags: list[str] = []

    interaction_notes: list[str] = []
    allergy_notes: list[str] = []

    # ---------------------------------------------------------
    # 1. Check Drug-Food Interactions
    # ---------------------------------------------------------
    if medications:
        known_interactions = get_medication_known_interactions(medications, db=db)
        seen_warnings: set[str] = set()

        for item in known_interactions:
            food_name = item.food.lower()
            if _match_word_in_text(food_name, answer):
                warn_key = f"{item.drug.lower()}_{food_name}"
                if warn_key not in seen_warnings:
                    seen_warnings.add(warn_key)
                    drug_display = item.drug.capitalize()
                    food_display = item.food.capitalize()
                    mech = item.mechanism.strip()
                    rec = item.recommendation.strip()
                    interaction_notes.append(
                        f"• Thuốc **{drug_display}**: Trong các thực phẩm nêu trên, **{food_display}** {mech} 👉 *Khuyến nghị:* {rec}"
                    )
                    flags.append("targeted_drug_food_interaction_alert")

    # ---------------------------------------------------------
    # 2. Check Allergy Matches
    # ---------------------------------------------------------
    if allergies:
        seen_allergy_keys: set[str] = set()
        for allergy in allergies:
            allergy_clean = allergy.strip().lower()
            related_foods = _ALLERGY_FOOD_MAP.get(allergy_clean, [allergy_clean])

            for food_term in related_foods:
                food_term_lower = food_term.lower()
                if _match_word_in_text(food_term_lower, answer):
                    key = f"{allergy_clean}_{food_term_lower}"
                    if key not in seen_allergy_keys:
                        seen_allergy_keys.add(key)
                        allergy_notes.append(
                            f"• Dị ứng **{allergy.capitalize()}**: Trong nội dung có đề cập **{food_term.capitalize()}** thuộc nhóm dị ứng của bạn — bạn **tuyệt đối không nên ăn/dùng** để tránh nguy cơ kích ứng hoặc phản vệ."
                        )
                        flags.append("targeted_allergy_alert")

    # ---------------------------------------------------------
    # 3. Construct Targeted Safety Footnote if Needed
    # ---------------------------------------------------------
    if not interaction_notes and not allergy_notes:
        return answer, flags

    # Avoid duplicating if already present in answer
    if "Lưu ý an toàn theo hồ sơ của bạn:" in answer or "LƯU Ý AN TOÀN THEO HỒ SƠ" in answer:
        return answer, flags

    footnote_lines = ["\n\n⚠️ **Lưu ý an toàn theo hồ sơ của bạn:**"]
    for note in interaction_notes:
        footnote_lines.append(note)
    for note in allergy_notes:
        footnote_lines.append(note)

    updated_answer = answer.strip() + "\n" + "\n".join(footnote_lines)
    return updated_answer, list(set(flags))
