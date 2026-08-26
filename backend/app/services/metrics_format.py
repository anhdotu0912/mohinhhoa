"""Parse/format helpers for body metrics structured + derived fields."""

from __future__ import annotations

import re

_BP_RE = re.compile(r"(\d{2,3})\s*/\s*(\d{2,3})")
_NUM_RE = re.compile(r"[\d]+(?:[.,]\d+)?")


def parse_blood_pressure(raw: str | None) -> tuple[int | None, int | None]:
    if not raw:
        return None, None
    match = _BP_RE.search(raw)
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


def format_blood_pressure(systolic: int | None, diastolic: int | None) -> str | None:
    if systolic is None or diastolic is None:
        return None
    return f"{systolic}/{diastolic} mmHg"


def parse_glucose_mmol(raw: str | None) -> float | None:
    if not raw:
        return None
    match = _NUM_RE.search(raw.replace(",", "."))
    if not match:
        return None
    value = float(match.group(0))
    if not (value == value):  # NaN
        return None
    if re.search(r"mmol", raw, re.I):
        return round(value, 1)
    if re.search(r"mg", raw, re.I) or value >= 40:
        return round(value / 18.018, 1)
    return round(value, 1)


def format_glucose_mmol(value: float | None) -> str | None:
    if value is None:
        return None
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    return f"{text} mmol/L"
