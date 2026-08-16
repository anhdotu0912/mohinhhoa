"""Nutrition Calculator Service — computes nutritional totals and validates restrictions.

Provides functions to sum macros for meals and daily plans, check against target
calories and dietary restrictions, and emit descriptive warning messages.
"""

from __future__ import annotations

import logging
from app.schemas.meal_plan import DayPlan, DayTotals, Macros, Meal
from app.schemas.profile import Restrictions

logger = logging.getLogger(__name__)


def calculate_meal_totals(meal: Meal) -> Macros:
    """Calculate combined macronutrients for all items in a single meal."""
    total_carb = 0.0
    total_protein = 0.0
    total_fat = 0.0
    total_sodium = 0.0
    total_sugar = 0.0

    for item in meal.items:
        total_carb += item.macros.carb_g
        total_protein += item.macros.protein_g
        total_fat += item.macros.fat_g
        total_sodium += item.macros.sodium_mg
        total_sugar += item.macros.sugar_g

    return Macros(
        carb_g=round(total_carb, 1),
        protein_g=round(total_protein, 1),
        fat_g=round(total_fat, 1),
        sodium_mg=round(total_sodium, 1),
        sugar_g=round(total_sugar, 1),
    )


def calculate_day_totals(day: DayPlan) -> DayTotals:
    """Calculate combined daily nutritional totals across all meals."""
    total_kcal = 0.0
    total_carb = 0.0
    total_protein = 0.0
    total_fat = 0.0
    total_sodium = 0.0
    total_sugar = 0.0

    for meal in day.meals:
        for item in meal.items:
            total_kcal += item.kcal
            total_carb += item.macros.carb_g
            total_protein += item.macros.protein_g
            total_fat += item.macros.fat_g
            total_sodium += item.macros.sodium_mg
            total_sugar += item.macros.sugar_g

    return DayTotals(
        kcal=round(total_kcal, 1),
        carb_g=round(total_carb, 1),
        protein_g=round(total_protein, 1),
        fat_g=round(total_fat, 1),
        sodium_mg=round(total_sodium, 1),
        sugar_g=round(total_sugar, 1),
    )


def validate_nutrition(
    day_plan: DayPlan,
    target_kcal: float = 1800,
    restrictions: Restrictions | None = None,
) -> list[str]:
    """Validate a day plan against caloric target and dietary restrictions.

    Args:
        day_plan: The DayPlan to evaluate.
        target_kcal: The patient's daily target calories (default 1800).
        restrictions: Optional Restrictions object (carb_per_meal, sodium_daily).

    Returns:
        List of warning strings explaining any threshold breaches.
    """
    warnings: list[str] = []
    totals = day_plan.totals or calculate_day_totals(day_plan)

    # 1. Kcal Target Check (±10% target band)
    lower_bound = target_kcal * 0.9
    upper_bound = target_kcal * 1.1

    if totals.kcal < lower_bound:
        warnings.append(
            f"Tổng Kcal ({totals.kcal:.0f} kcal) thấp hơn ngưỡng khuyến nghị "
            f"({lower_bound:.0f}–{upper_bound:.0f} kcal cho mục tiêu {target_kcal:.0f} kcal)."
        )
    elif totals.kcal > upper_bound:
        warnings.append(
            f"Tổng Kcal ({totals.kcal:.0f} kcal) cao hơn ngưỡng khuyến nghị "
            f"({lower_bound:.0f}–{upper_bound:.0f} kcal cho mục tiêu {target_kcal:.0f} kcal)."
        )

    if restrictions:
        # 2. Sodium Daily Check
        if restrictions.sodium_daily and totals.sodium_mg > restrictions.sodium_daily:
            warnings.append(
                f"Tổng Natri/ngày ({totals.sodium_mg:.0f}mg) vượt quá ngưỡng giới hạn "
                f"({restrictions.sodium_daily:.0f}mg/ngày)."
            )
        elif restrictions.sodium_daily and totals.sodium_mg >= restrictions.sodium_daily * 0.85:
            warnings.append(
                f"Lượng Natri/ngày ({totals.sodium_mg:.0f}mg) sắp chạm ngưỡng giới hạn "
                f"({restrictions.sodium_daily:.0f}mg/ngày)."
            )

        # 3. Per-Meal Carb Check
        if restrictions.carb_per_meal:
            for meal in day_plan.meals:
                meal_macros = calculate_meal_totals(meal)
                if meal_macros.carb_g > restrictions.carb_per_meal:
                    slot_name = {
                        "breakfast": "Bữa sáng",
                        "lunch": "Bữa trưa",
                        "dinner": "Bữa tối",
                        "snack": "Bữa phụ",
                    }.get(meal.slot, meal.slot)
                    warnings.append(
                        f"{slot_name} có lượng Carb ({meal_macros.carb_g:.1f}g) vượt "
                        f"ngưỡng cho phép ({restrictions.carb_per_meal:.1f}g/bữa)."
                    )

        # 4. Sugar Daily Check
        if restrictions.sugar_daily_g and totals.sugar_g > restrictions.sugar_daily_g:
            warnings.append(
                f"Tổng Đường tự do/ngày ({totals.sugar_g:.1f}g) vượt quá ngưỡng giới hạn "
                f"({restrictions.sugar_daily_g:.1f}g/ngày)."
            )
        elif (
            restrictions.sugar_daily_g
            and totals.sugar_g >= restrictions.sugar_daily_g * 0.85
        ):
            warnings.append(
                f"Lượng Đường tự do/ngày ({totals.sugar_g:.1f}g) sắp chạm ngưỡng giới hạn "
                f"({restrictions.sugar_daily_g:.1f}g/ngày)."
            )

    return warnings
