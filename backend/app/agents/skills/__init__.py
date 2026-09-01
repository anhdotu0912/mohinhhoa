"""Modular Skills package for P-014 AI Agent.

Provides Primitive Skills (core atomic domain logic), Utility Skills (triage, clarification, greetings),
and Skill Registry (Description Engineering & Schema generation).
"""

from app.agents.skills.primitive_skills import (
    check_allergy_match,
    check_drug_food_interaction,
    get_doctor_notes,
    get_metrics_delta_advice,
    get_patient_meal_plan,
    get_weekly_adherence_summary,
    log_food_adherence,
    search_medical_guidelines,
)
from app.agents.skills.registry import (
    SKILL_REGISTRY,
    SkillCategory,
    SkillDefinition,
    format_intent_classification_prompt_snippet,
    get_all_skill_definitions,
    get_all_skill_descriptions,
    get_bound_tool_schema_for_intent,
    get_lean_state_for_intent,
    get_openai_tools_schema,
    get_skill_definition,
    get_skills_by_category,
)
from app.agents.skills.utility_skills import (
    ask_clarification,
    chit_chat_greeting,
    detect_clinical_danger,
    emergency_triage_check,
    refuse_unsafe_medication,
)

__all__ = [
    # Primitive skills
    "get_patient_meal_plan",
    "check_drug_food_interaction",
    "check_allergy_match",
    "search_medical_guidelines",
    "log_food_adherence",
    "get_weekly_adherence_summary",
    "get_metrics_delta_advice",
    "get_doctor_notes",
    # Utility skills
    "emergency_triage_check",
    "detect_clinical_danger",
    "ask_clarification",
    "chit_chat_greeting",
    "refuse_unsafe_medication",
    # Registry & Metadata
    "SkillCategory",
    "SkillDefinition",
    "SKILL_REGISTRY",
    "get_skill_definition",
    "get_all_skill_definitions",
    "get_skills_by_category",
    "get_all_skill_descriptions",
    "format_intent_classification_prompt_snippet",
    "get_openai_tools_schema",
    "get_bound_tool_schema_for_intent",
    "get_lean_state_for_intent",
]
