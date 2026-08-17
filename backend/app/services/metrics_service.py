"""Body metrics history — snapshot + time-series (ADR-013)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.body_metrics import BodyMetricsEntry
from app.models.profile import Profile
from app.schemas.body_metrics import MetricsLogCreate


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


def record_patient_metrics(
    db: Session,
    user_id: str,
    payload: MetricsLogCreate,
) -> BodyMetricsEntry:
    profile = _get_or_create_profile(db, user_id)

    weight = payload.weight if payload.weight is not None else profile.weight
    height = payload.height if payload.height is not None else profile.height
    blood_pressure = payload.blood_pressure if payload.blood_pressure is not None else profile.blood_pressure
    blood_glucose = payload.blood_glucose if payload.blood_glucose is not None else profile.blood_glucose

    bmi: float | None = profile.bmi
    if weight is not None and height is not None and height > 0:
        bmi = _calc_bmi(weight, height)

    if payload.weight is not None:
        profile.weight = payload.weight
    if payload.height is not None:
        profile.height = payload.height
    if bmi is not None:
        profile.bmi = bmi
    if payload.blood_pressure is not None:
        profile.blood_pressure = payload.blood_pressure.strip() or None
    if payload.blood_glucose is not None:
        profile.blood_glucose = payload.blood_glucose.strip() or None

    entry = BodyMetricsEntry(
        user_id=user_id,
        weight=weight,
        height=height,
        bmi=bmi,
        blood_pressure=blood_pressure,
        blood_glucose=blood_glucose,
        note=payload.note.strip(),
        recorded_by="patient",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def record_doctor_metrics(
    db: Session,
    user_id: str,
    weight: float,
    height: float,
    bmi: float,
) -> BodyMetricsEntry:
    profile = _get_or_create_profile(db, user_id)
    entry = BodyMetricsEntry(
        user_id=user_id,
        weight=weight,
        height=height,
        bmi=bmi,
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
