"""Nutrition catalog models — foods, recipes, drug products/rules from data/clean/."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


class FoodComposition(Base):
    """Raw food composition entry (foods.sample.json)."""

    __tablename__ = "food_compositions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name_vi: Mapped[str] = mapped_column(String(255), index=True)
    name_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    normalized_vi: Mapped[str | None] = mapped_column(String(255), nullable=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    food_group: Mapped[str] = mapped_column(String(128), index=True)
    basis_g: Mapped[float] = mapped_column(Float, default=100.0)
    nutrition: Mapped[dict] = mapped_column(JSON, default=dict)
    diabetes_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Recipe(Base):
    """Prepared recipe / dish (recipes.sample.json)."""

    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name_vi: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    cooking_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    servings: Mapped[int] = mapped_column(Integer, default=1)
    ingredients: Mapped[list] = mapped_column(JSON, default=list)
    nutrition: Mapped[dict] = mapped_column(JSON, default=dict)
    diabetes_screening: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DrugProduct(Base):
    """Commercial drug product (drug_products.json)."""

    __tablename__ = "drug_products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    product_name: Mapped[str] = mapped_column(String(255), index=True)
    normalized_name: Mapped[str] = mapped_column(String(255), index=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    active_ingredient_text: Mapped[str] = mapped_column(String(255))
    active_key: Mapped[str] = mapped_column(String(64), index=True)
    drug_class: Mapped[str | None] = mapped_column(String(128), nullable=True)
    formulation_profile: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rule_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sources: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DrugRule(Base):
    """Clinical drug safety rule (drug_rules.json)."""

    __tablename__ = "drug_rules"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    active_key: Mapped[str] = mapped_column(String(64), index=True)
    active_ingredients: Mapped[list] = mapped_column(JSON, default=list)
    drug_class: Mapped[str | None] = mapped_column(String(128), nullable=True)
    formulation_profile: Mapped[str | None] = mapped_column(String(128), nullable=True)
    applicable_diabetes_types: Mapped[list] = mapped_column(JSON, default=list)
    diabetes_applicability: Mapped[dict] = mapped_column(JSON, default=dict)
    meal_timing: Mapped[dict] = mapped_column(JSON, default=dict)
    carbohydrate_rule: Mapped[dict] = mapped_column(JSON, default=dict)
    safety: Mapped[dict] = mapped_column(JSON, default=dict)
    sources: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
