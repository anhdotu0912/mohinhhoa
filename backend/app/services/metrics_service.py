"""Body metrics history — snapshot + time-series (ADR-013)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar

from sqlalchemy.orm import Session

from app.core.datetime_vn import utc_now_naive, vn_day_bounds_utc
from app.models.body_metrics import BodyMetricsEntry
from app.models.profile import Profile
from app.schemas.body_metrics import MetricsLogCreate
from app.services.metrics_delta_advice import snapshot_from_entry
from app.services.metrics_format import (
    format_blood_pressure,
    format_glucose_mmol,
    parse_blood_pressure,
    parse_glucose_mmol,
)

T = TypeVar("T")


def _calc_bmi(weight: float, height_cm: float) -> float:
    height_m = height_cm / 100.0
    return round(weight / (height_m * height_m), 1)


def _get_or_create_profile(db: Session, user_id: str) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile is None:
        profile = Profile(user_id=user_id)
        db.add(profile)
        db.flush()
    return profile


def _find_patient_entry_for_vn_day(
    db: Session,
    user_id: str,
    day_start_utc: datetime,
    day_end_utc: datetime,
) -> BodyMetricsEntry | None:
    return (
        db.query(BodyMetricsEntry)
        .filter(
            BodyMetricsEntry.user_id == user_id,
            BodyMetricsEntry.recorded_by == "patient",
            BodyMetricsEntry.recorded_at >= day_start_utc,
            BodyMetricsEntry.recorded_at < day_end_utc,
        )
        .order_by(BodyMetricsEntry.recorded_at.desc())
        .first()
    )


def _coalesce(payload_value: T | None, existing_value: T | None, fallback: T | None) -> T | None:
    if payload_value is not None:
        return payload_value
    if existing_value is not None:
        return existing_value
    return fallback


def _resolve_metric_values(
    payload: MetricsLogCreate,
    profile: Profile,
    existing: BodyMetricsEntry | None,
) -> dict[str, Any]:
    src = existing

    weight = _coalesce(payload.weight, src.weight if src else None, profile.weight)
    height = _coalesce(payload.height, src.height if src else None, profile.height)
    waist_cm = _coalesce(payload.waist_cm, src.waist_cm if src else None, None)
    hba1c = _coalesce(payload.hba1c, src.hba1c if src else None, None)
    glucose_postprandial = _coalesce(
        payload.glucose_postprandial,
        src.glucose_postprandial if src else None,
        None,
    )

    payload_sys, payload_dia = payload.systolic, payload.diastolic
    if payload_sys is None and payload.blood_pressure is not None:
        payload_sys, payload_dia = parse_blood_pressure(payload.blood_pressure)

    existing_sys = src.systolic if src else None
    existing_dia = src.diastolic if src else None
    if existing_sys is None and src is not None:
        existing_sys, existing_dia = parse_blood_pressure(src.blood_pressure)
    profile_sys, profile_dia = parse_blood_pressure(profile.blood_pressure)

    systolic = _coalesce(payload_sys, existing_sys, profile_sys)
    diastolic = _coalesce(payload_dia, existing_dia, profile_dia)

    payload_fasting = payload.glucose_fasting
    if payload_fasting is None and payload.blood_glucose is not None:
        payload_fasting = parse_glucose_mmol(payload.blood_glucose)

    existing_fasting = src.glucose_fasting if src else None
    if existing_fasting is None and src is not None:
        existing_fasting = parse_glucose_mmol(src.blood_glucose)
    profile_fasting = parse_glucose_mmol(profile.blood_glucose)

    glucose_fasting = _coalesce(payload_fasting, existing_fasting, profile_fasting)

    if payload.blood_pressure is not None:
        blood_pressure = payload.blood_pressure.strip() or format_blood_pressure(
            systolic, diastolic
        )
    elif payload.systolic is not None:
        blood_pressure = format_blood_pressure(systolic, diastolic)
    elif src is not None and src.blood_pressure:
        blood_pressure = src.blood_pressure
    else:
        blood_pressure = format_blood_pressure(systolic, diastolic) or profile.blood_pressure

    if payload.blood_glucose is not None:
        blood_glucose = payload.blood_glucose.strip() or format_glucose_mmol(glucose_fasting)
    elif payload.glucose_fasting is not None or payload.glucose_postprandial is not None:
        blood_glucose = format_glucose_mmol(glucose_fasting) or format_glucose_mmol(
            glucose_postprandial
        )
    elif src is not None and src.blood_glucose:
        blood_glucose = src.blood_glucose
    else:
        blood_glucose = format_glucose_mmol(glucose_fasting) or profile.blood_glucose

    if payload.note and payload.note.strip():
        note = payload.note.strip()
    elif src is not None:
        note = src.note
    else:
        note = payload.note.strip()

    return {
        "weight": weight,
        "height": height,
        "waist_cm": waist_cm,
        "systolic": systolic,
        "diastolic": diastolic,
        "glucose_fasting": glucose_fasting,
        "glucose_postprandial": glucose_postprandial,
        "hba1c": hba1c,
        "blood_pressure": blood_pressure.strip() if blood_pressure else None,
        "blood_glucose": blood_glucose.strip() if blood_glucose else None,
        "note": note,
    }


def _update_profile_snapshot(
    profile: Profile,
    payload: MetricsLogCreate,
    values: dict[str, Any],
    bmi: float | None,
) -> None:
    if payload.weight is not None:
        profile.weight = payload.weight
    if payload.height is not None:
        profile.height = payload.height
    if bmi is not None:
        profile.bmi = bmi
    if payload.blood_pressure is not None or payload.systolic is not None:
        profile.blood_pressure = values["blood_pressure"]
    if (
        payload.blood_glucose is not None
        or payload.glucose_fasting is not None
        or payload.glucose_postprandial is not None
    ):
        profile.blood_glucose = values["blood_glucose"]


def _apply_values(entry: BodyMetricsEntry, values: dict[str, Any], bmi: float | None) -> None:
    entry.weight = values["weight"]
    entry.height = values["height"]
    entry.bmi = bmi
    entry.waist_cm = values["waist_cm"]
    entry.systolic = values["systolic"]
    entry.diastolic = values["diastolic"]
    entry.glucose_fasting = values["glucose_fasting"]
    entry.glucose_postprandial = values["glucose_postprandial"]
    entry.hba1c = values["hba1c"]
    entry.blood_pressure = values["blood_pressure"]
    entry.blood_glucose = values["blood_glucose"]
    entry.note = values["note"]


def record_patient_metrics(
    db: Session,
    user_id: str,
    payload: MetricsLogCreate,
) -> tuple[BodyMetricsEntry, dict[str, Any] | None]:
    """Upsert today's patient row. Returns (saved_entry, previous_snapshot)."""
    profile = _get_or_create_profile(db, user_id)
    day_start, day_end = vn_day_bounds_utc()
    existing = _find_patient_entry_for_vn_day(db, user_id, day_start, day_end)
    previous_row = existing
    if previous_row is None:
        previous_row = (
            db.query(BodyMetricsEntry)
            .filter(BodyMetricsEntry.user_id == user_id)
            .order_by(BodyMetricsEntry.recorded_at.desc())
            .first()
        )
    previous_snapshot = snapshot_from_entry(previous_row)

    values = _resolve_metric_values(payload, profile, existing)

    bmi: float | None = profile.bmi
    weight = values["weight"]
    height = values["height"]
    if weight is not None and height is not None and height > 0:
        bmi = _calc_bmi(weight, height)

    _update_profile_snapshot(profile, payload, values, bmi)

    now = utc_now_naive()

    if existing is not None:
        _apply_values(existing, values, bmi)
        existing.recorded_at = now
        db.commit()
        db.refresh(existing)
        return existing, previous_snapshot

    entry = BodyMetricsEntry(
        user_id=user_id,
        recorded_by="patient",
        recorded_at=now,
    )
    _apply_values(entry, values, bmi)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry, previous_snapshot


def record_doctor_metrics(
    db: Session,
    user_id: str,
    weight: float,
    height: float,
    bmi: float,
) -> BodyMetricsEntry:
    profile = _get_or_create_profile(db, user_id)
    sys, dia = parse_blood_pressure(profile.blood_pressure)
    entry = BodyMetricsEntry(
        user_id=user_id,
        weight=weight,
        height=height,
        bmi=bmi,
        systolic=sys,
        diastolic=dia,
        glucose_fasting=parse_glucose_mmol(profile.blood_glucose),
        blood_pressure=profile.blood_pressure,
        blood_glucose=profile.blood_glucose,
        note="",
        recorded_by="doctor",
    )
    db.add(entry)
    db.flush()
    return entry


def list_metrics_history(
    db: Session,
    user_id: str,
    days: int = 90,
) -> list[BodyMetricsEntry]:
    days = max(1, min(days, 365))
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
    return (
        db.query(BodyMetricsEntry)
        .filter(BodyMetricsEntry.user_id == user_id, BodyMetricsEntry.recorded_at >= since)
        .order_by(BodyMetricsEntry.recorded_at.asc())
        .all()
    )


def delete_metrics_entry(db: Session, user_id: str, entry_id: str) -> bool:
    entry = (
        db.query(BodyMetricsEntry)
        .filter(BodyMetricsEntry.id == entry_id, BodyMetricsEntry.user_id == user_id)
        .first()
    )
    if entry is None:
        return False
    db.delete(entry)
    db.commit()
    return True
