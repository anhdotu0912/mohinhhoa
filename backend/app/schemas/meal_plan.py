"""Pydantic schemas for MealPlan, Agent I/O — matches contract §1.2, §2."""

from pydantic import BaseModel, Field

# --- Shared types ---

class Macros(BaseModel):
    """Macronutrient breakdown."""
    carb_g: float = 0
    protein_g: float = 0
    fat_g: float = 0
    sodium_mg: float = 0


# --- MealPlan schemas (contract §1.2) ---

class FoodItem(BaseModel):
    """Single food item in a meal."""
    name: str
    portion: str = ""
    kcal: float = 0
    macros: Macros = Field(default_factory=Macros)
    food_id: str | None = None
    citations: list[str] = Field(default_factory=list)


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


class InteractionCheckOutput(BaseModel):
    """Output of InteractionCheckerAgent — contract §3."""
    interactions: list[InteractionItem] = Field(default_factory=list)


# --- Agent Graph I/O (contract §2) ---

class AgentRunInput(BaseModel):
    """Input to run_agent facade."""
    user_id: str
    message: str
    force_intent: str | None = None


class AgentRunOutput(BaseModel):
    """Output of run_agent facade."""
    intent: str = "unknown"
    message: str = ""
    meal_plan_id: str | None = None
    food_log_id: str | None = None
    alert_ids: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    guardrail_triggered: bool = False
