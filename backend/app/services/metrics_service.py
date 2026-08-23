"""Body metrics history — snapshot + time-series (ADR-013)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.datetime_vn import utc_now_naive, vn_day_bounds_utc
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


def _resolve_metric_values(
    payload: MetricsLogCreate,
    profile: Profile,
    existing: BodyMetricsEntry | None,
) -> tuple[float | None, float | None, str | None, str | None, str]:
    if existing is None:
        weight = payload.weight if payload.weight is not None else profile.weight
        height = payload.height if payload.height is not None else profile.height
        blood_pressure = (
            payload.blood_pressure if payload.blood_pressure is not None else profile.blood_pressure
        )
        blood_glucose = (
            payload.blood_glucose if payload.blood_glucose is not None else profile.blood_glucose
        )
        note = payload.note.strip()
    else:
        weight = payload.weight if payload.weight is not None else existing.weight
        if weight is None:
            weight = profile.weight

        height = payload.height if payload.height is not None else existing.height
        if height is None:
            height = profile.height

        if payload.blood_pressure is not None:
            blood_pressure = payload.blood_pressure.strip() or None
        else:
            blood_pressure = existing.blood_pressure
            if blood_pressure is None:
                blood_pressure = profile.blood_pressure

        if payload.blood_glucose is not None:
            blood_glucose = payload.blood_glucose.strip() or None
        else:
            blood_glucose = existing.blood_glucose
            if blood_glucose is None:
                blood_glucose = profile.blood_glucose

        note = payload.note.strip() or existing.note

    if blood_pressure is not None:
        blood_pressure = blood_pressure.strip() or None
    if blood_glucose is not None:
        blood_glucose = blood_glucose.strip() or None

    return weight, height, blood_pressure, blood_glucose, note


def _update_profile_snapshot(
    profile: Profile,
    payload: MetricsLogCreate,
    bmi: float | None,
) -> None:
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


def record_patient_metrics(
    db: Session,
    user_id: str,
    payload: MetricsLogCreate,
) -> BodyMetricsEntry:
    profile = _get_or_create_profile(db, user_id)
    day_start, day_end = vn_day_bounds_utc()
    existing = _find_patient_entry_for_vn_day(db, user_id, day_start, day_end)

    weight, height, blood_pressure, blood_glucose, note = _resolve_metric_values(
        payload, profile, existing
    )

    bmi: float | None = profile.bmi
    if weight is not None and height is not None and height > 0:
        bmi = _calc_bmi(weight, height)

    _update_profile_snapshot(profile, payload, bmi)

    now = utc_now_naive()

    if existing is not None:
        existing.weight = weight
        existing.height = height
        existing.bmi = bmi
        existing.blood_pressure = blood_pressure
        existing.blood_glucose = blood_glucose
        existing.note = note
        existing.recorded_at = now
        db.commit()
        db.refresh(existing)
        return existing

    entry = BodyMetricsEntry(
        user_id=user_id,
        weight=weight,
        height=height,
        bmi=bmi,
        blood_pressure=blood_pressure,
        blood_glucose=blood_glucose,
        note=note,
        recorded_by="patient",
        recorded_at=now,
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
