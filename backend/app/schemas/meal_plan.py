"""Pydantic schemas for MealPlan, Agent I/O — matches contract §1.2, §2."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.body_metrics import MetricsDeltaAdviceOut

# --- Shared types ---

class Macros(BaseModel):
    """Macronutrient breakdown."""
    carb_g: float = 0
    protein_g: float = 0
    fat_g: float = 0
    sodium_mg: float = 0
    sugar_g: float = 0


# --- MealPlan schemas (contract §1.2) ---

class FoodItem(BaseModel):
    """Single food item in a meal."""
    name: str
    portion: str = ""
    kcal: float = 0
    macros: Macros = Field(default_factory=Macros)
    food_id: str | None = None
    citations: list[str] = Field(default_factory=list)
    alternatives: list["FoodItem"] = Field(default_factory=list)


class Meal(BaseModel):
    """A single meal slot."""
    slot: str = Field(description="breakfast | lunch | dinner | snack")
    items: list[FoodItem] = Field(default_factory=list)


class DayTotals(BaseModel):
    """Daily nutrition totals."""
    kcal: float = 0
    carb_g: float = 0
    protein_g: float = 0
    fat_g: float = 0
    sodium_mg: float = 0
    sugar_g: float = 0


class DayPlan(BaseModel):
    """Plan for one day."""
    day_index: int
    date: str | None = None
    meals: list[Meal] = Field(default_factory=list)
    totals: DayTotals = Field(default_factory=DayTotals)
    warnings: list[str] = Field(default_factory=list)


class Swap(BaseModel):
    """Food swap due to drug-food interaction."""
    day_index: int
    slot: str
    from_food: str = Field(alias="from", serialization_alias="from")
    to: str
    reason: str

    model_config = {"populate_by_name": True}


class GenerateMealPlanRequest(BaseModel):
    """Optional doctor/patient notes forwarded to the meal planner LLM."""
    notes: str = ""
    priorities: list[str] = Field(default_factory=list)


ApplyMode = Literal["from_today", "after_current"]


class ApplyMealPlanRequest(BaseModel):
    """Doctor assigns validity window after HITL approval."""
    start_date: date | None = None
    replace_active: bool = False
    slot_key: Literal["current", "next", "empty"] | None = None
    apply_mode: ApplyMode | None = None

    @model_validator(mode="after")
    def require_start_or_mode(self) -> "ApplyMealPlanRequest":
        if self.apply_mode is None and self.start_date is None:
            raise ValueError("Cần apply_mode hoặc start_date.")
        return self


class RequestAdjustmentRequest(BaseModel):
    """Patient request to adjust an approved meal plan."""
    adjustment_note: str = Field(min_length=1)


class MealPlanRequestIn(BaseModel):
    """Patient request for doctor to create a meal plan."""
    note: str = ""


class MealPlanRequestOut(BaseModel):
    """Status of patient's meal plan creation request."""
    status: Literal["none", "pending"] = "none"
    note: str | None = None
    requested_at: str | None = None


class MealPlanOutput(BaseModel):
    """Full multi-day meal plan output — contract §1.2."""
    id: str = ""
    variant_group_id: str | None = None
    variant_index: int | None = None
    total_variants: int | None = None
    user_id: str = ""
    profile_snapshot: dict = Field(default_factory=dict)
    days: list[DayPlan] = Field(default_factory=list)
    swaps: list[Swap] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    status: str = "pending_review"
    adjustment_note: str | None = None
    starts_on: str | None = None
    ends_on: str | None = None
    created_at: str | None = None


# --- Alert schema (contract §1.4) ---

class Alert(BaseModel):
    """Drug-food interaction alert."""
    id: str = ""
    user_id: str = ""
    drug: str
    food: str
    mechanism: str
    severity: str = Field(description="Nguy hiểm | Cần chú ý | An toàn")
    recommendation: str
    sources: list[str] = Field(default_factory=list)
    meal_plan_id: str | None = None
    food_log_id: str | None = None
    created_at: str = ""


# --- InteractionChecker I/O (contract §3) ---

class InteractionCheckInput(BaseModel):
    """Input for InteractionCheckerAgent."""
    medications: list[str]
    foods: list[str]
    profile_user_id: str | None = None


class InteractionItem(BaseModel):
    """Single drug-food interaction result."""
    drug: str
    food: str
    mechanism: str
    severity: str
    recommendation: str
    sources: list[str] = Field(default_factory=list)
    # Extended clinical fields from drug_rules.json (optional)
    drug_class: str | None = None
    meal_timing: str | None = None
    hypoglycemia_risk: str | None = None
    ai_warning: str | None = None


class UnmatchedPair(BaseModel):
    """Drug×food pair with no KB data — contract §6."""
    drug: str
    food: str


class InteractionCheckOutput(BaseModel):
    """Output of InteractionCheckerAgent — contract §3."""
    interactions: list[InteractionItem] = Field(default_factory=list)
    unmatched_pairs: list[UnmatchedPair] = Field(default_factory=list)


# --- Agent Graph I/O (contract §2) ---

class AgentRunInput(BaseModel):
    """Input to run_agent facade."""
    user_id: str
    message: str
    force_intent: str | None = None


class MealPreviewMeal(BaseModel):
    """Single meal slot in chat meal preview."""
    slot: str
    label: str
    items: list[FoodItem] = Field(default_factory=list)


class MealPreviewOut(BaseModel):
    """Structured meal preview for chat UI — read-only from existing plan."""
    date: str
    day_index: int
    meal_plan_id: str
    plan_status: str
    meals: list[MealPreviewMeal] = Field(default_factory=list)


class WeeklyComplianceDayPoint(BaseModel):
    """Same shape as doctor.ComplianceDayPoint (duplicate here to avoid circular import)."""
    date: str
    adherence_pct: int | None = None


class WeeklyComplianceOut(BaseModel):
    """Weekly adherence summary for chat — subset of PatientComplianceOut."""
    overall_adherence_pct: int | None = None
    daily_series: list[WeeklyComplianceDayPoint] = Field(default_factory=list)


class DoctorNoteItem(BaseModel):
    """One manual_reminder row in the doctor_note list."""
    id: str
    title: str = ""
    note: str
    created_at: datetime
    tags: list[str] = Field(default_factory=list)


class DoctorNoteOut(BaseModel):
    """Doctor reminders surfaced in patient chat.

    ``note`` / ``created_at`` / ``tags`` mirror the latest item for older clients.
    ``notes`` is the full list (newest first, cap 10).
    """
    doctor_name: str
    doctor_avatar: str | None = None
    note: str
    created_at: datetime
    tags: list[str] = Field(default_factory=list)
    has_more: bool = False
    notes: list[DoctorNoteItem] = Field(default_factory=list)


class CitationChunk(BaseModel):
    """A RAG passage that was actually injected into the answer prompt."""
    chunk_id: str = ""
    text: str = ""
    source: str = ""
    score: float = 0.0


class AgentRunOutput(BaseModel):
    """Output of run_agent facade."""
    intent: str = "unknown"
    secondary_intents: list[str] = Field(default_factory=list)
    message: str = ""
    meal_plan_id: str | None = None
    meal_preview: MealPreviewOut | None = None
    food_log_id: str | None = None
    alert_ids: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    citation_chunks: list[CitationChunk] = Field(default_factory=list)
    guardrail_triggered: bool = False
    weekly_compliance: WeeklyComplianceOut | None = None
    doctor_note: DoctorNoteOut | None = None
    metrics_delta_advice: MetricsDeltaAdviceOut | None = None
    unmatched_pairs: list[UnmatchedPair] = Field(default_factory=list)


FoodItem.model_rebuild()
