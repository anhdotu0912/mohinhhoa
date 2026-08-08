"""Deterministic demo data for DEMO_MOCK mode (contract-shaped, clearly marked)."""

from __future__ import annotations

from app.schemas.meal_plan import (
    DayPlan,
    DayTotals,
    FoodItem,
    InteractionCheckInput,
    InteractionCheckOutput,
    InteractionItem,
    Macros,
    Meal,
    MealPlanOutput,
    Swap,
)
from app.schemas.profile import PatientProfile

MOCK_CITATION = "demo_mock"

_ROTATIONS: dict[str, list[dict]] = {
    "breakfast": [
        {"name": "Bánh mì nguyên cám + trứng ốp la", "portion": "2 lát bánh + 1 trứng", "kcal": 320, "carb_g": 38, "protein_g": 14, "fat_g": 12, "sodium_mg": 420},
        {"name": "Cháo yến mạch + sữa tươi không đường", "portion": "1 bát (~250ml)", "kcal": 290, "carb_g": 42, "protein_g": 12, "fat_g": 7, "sodium_mg": 180},
    ],
    "lunch": [
        {"name": "Cơm gạo lứt + cá basa kho + rau muống xào tỏi", "portion": "1 chén cơm + 100g cá + 1 đĩa rau", "kcal": 560, "carb_g": 52, "protein_g": 30, "fat_g": 22, "sodium_mg": 520},
        {"name": "Cơm gạo lứt + thịt gà luộc + canh rau ngót", "portion": "1 chén cơm + 100g gà + 1 bát canh", "kcal": 540, "carb_g": 50, "protein_g": 32, "fat_g": 18, "sodium_mg": 460},
    ],
    "dinner": [
        {"name": "Bún gạo lứt + tôm luộc + rau sống", "portion": "1 tô vừa", "kcal": 480, "carb_g": 46, "protein_g": 26, "fat_g": 14, "sodium_mg": 500},
        {"name": "Cơm gạo lứt + đậu hũ sốt cà + bông cải xanh luộc", "portion": "1 chén cơm + 100g đậu hũ + 1 đĩa rau", "kcal": 500, "carb_g": 48, "protein_g": 24, "fat_g": 16, "sodium_mg": 440},
    ],
    "snack": [
        {"name": "Sữa chua không đường + hạt hạnh nhân", "portion": "1 hũ + 15g hạt", "kcal": 180, "carb_g": 12, "protein_g": 8, "fat_g": 10, "sodium_mg": 90},
        {"name": "Trái cây ít ngọt (ổi/táo)", "portion": "1 quả vừa", "kcal": 90, "carb_g": 20, "protein_g": 1, "fat_g": 0.5, "sodium_mg": 5},
    ],
}


def _food_item(data: dict) -> FoodItem:
    return FoodItem(
        name=data["name"],
        portion=data["portion"],
        kcal=data["kcal"],
        macros=Macros(
            carb_g=data["carb_g"],
            protein_g=data["protein_g"],
            fat_g=data["fat_g"],
            sodium_mg=data["sodium_mg"],
        ),
        citations=[MOCK_CITATION],
    )


def build_mock_meal_plan(profile: PatientProfile) -> MealPlanOutput:
    """Build a deterministic 7-day plan respecting target_kcal."""
    days: list[DayPlan] = []
    for day_index in range(1, 8):
        meals: list[Meal] = []
        totals = DayTotals()
        for slot in ("breakfast", "lunch", "dinner", "snack"):
            rotation = _ROTATIONS[slot]
            item_data = rotation[(day_index + len(rotation) - 1) % len(rotation)]
            item = _food_item(item_data)
            meals.append(Meal(slot=slot, items=[item]))
            totals.kcal += item.kcal
            totals.carb_g += item.macros.carb_g
            totals.protein_g += item.macros.protein_g
            totals.fat_g += item.macros.fat_g
            totals.sodium_mg += item.macros.sodium_mg
        totals.kcal = round(totals.kcal, 1)
        totals.carb_g = round(totals.carb_g, 1)
        totals.protein_g = round(totals.protein_g, 1)
        totals.fat_g = round(totals.fat_g, 1)
        totals.sodium_mg = round(totals.sodium_mg, 1)
        warnings: list[str] = []
        if profile.restrictions.sodium_daily and totals.sodium_mg > profile.restrictions.sodium_daily:
            warnings.append("sodium gần ngưỡng cho phép trong ngày")
        if profile.restrictions.carb_per_meal:
            for meal in meals:
                meal_carb = sum(i.macros.carb_g for i in meal.items)
                if meal_carb > profile.restrictions.carb_per_meal:
                    warnings.append(f"carb bữa {meal.slot} vượt ngưỡng {profile.restrictions.carb_per_meal}g")
        days.append(DayPlan(
            day_index=day_index,
            meals=meals,
            totals=totals,
            warnings=warnings,
        ))

    return MealPlanOutput(
        profile_snapshot=profile.model_dump(),
        days=days,
        swaps=[Swap(
            day_index=2,
            slot="lunch",
            from_food="rau muống xào tỏi",
            to="rau ngót luộc",
            reason="interaction:warfarin",
        )],
        citations=[MOCK_CITATION],
        status="pending_review",
    )


# Drug–food interaction KB used only by DEMO_MOCK (contract §3 shape).
INTERACTION_KB: list[InteractionItem] = [
    InteractionItem(
        drug="warfarin",
        food="rau muống",
        mechanism="Rau muống giàu vitamin K, đối kháng tác dụng chống đông của warfarin.",
        severity="Nguy hiểm",
        recommendation="Hạn chế và giữ ổn định lượng rau giàu vitamin K; trao đổi với bác sĩ.",
        sources=[MOCK_CITATION],
    ),
    InteractionItem(
        drug="warfarin",
        food="bông cải xanh",
        mechanism="Bông cải xanh giàu vitamin K, có thể làm giảm hiệu quả warfarin.",
        severity="Cần chú ý",
        recommendation="Duy trì lượng ăn ổn định và theo dõi chỉ số INR theo chỉ định.",
        sources=[MOCK_CITATION],
    ),
]


def check_interactions(input_data: InteractionCheckInput) -> InteractionCheckOutput:
    """Scan KB with normalized substring matching on drug and food names."""
    found: list[InteractionItem] = []
    meds = [m.strip().lower() for m in input_data.medications if m.strip()]
    foods = [f.strip().lower() for f in input_data.foods if f.strip()]
    for item in INTERACTION_KB:
        if item.drug.lower() not in meds:
            continue
        if any(item.food.lower() in food or food in item.food.lower() for food in foods):
            found.append(item)
    return InteractionCheckOutput(interactions=found)
