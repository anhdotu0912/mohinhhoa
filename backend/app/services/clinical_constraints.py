"""HITL gate for clinical constraints: patient proposals vs doctor-approved values."""

from __future__ import annotations

from app.models.profile import Profile
from app.schemas.profile import ProfileUpsert, Restrictions


def _normalize_restrictions(value: dict | Restrictions | None) -> dict:
    if value is None:
        return {}
    if isinstance(value, Restrictions):
        data = value.model_dump()
    else:
        data = dict(value)
    return {k: v for k, v in data.items() if v is not None}


def _restrictions_differ(left: dict | None, right: dict | Restrictions | None) -> bool:
    return _normalize_restrictions(left) != _normalize_restrictions(right)


def has_pending_proposal(row: Profile) -> bool:
    return (
        getattr(row, "proposed_target_kcal", None) is not None
        or getattr(row, "proposed_restrictions", None) is not None
        or getattr(row, "proposed_treatment_goals", None) is not None
    )


def clear_proposals(row: Profile) -> None:
    row.proposed_target_kcal = None
    row.proposed_restrictions = None
    row.proposed_treatment_goals = None


def store_patient_proposals(row: Profile, payload: ProfileUpsert) -> bool:
    """Persist clinical fields as proposals only. Returns True if any proposal is pending."""
    provided = payload.model_fields_set

    if "target_kcal" in provided and payload.target_kcal is not None:
        if payload.target_kcal != (row.target_kcal or 1800):
            row.proposed_target_kcal = payload.target_kcal

    if "restrictions" in provided and payload.restrictions is not None:
        if _restrictions_differ(row.restrictions, payload.restrictions):
            row.proposed_restrictions = payload.restrictions.model_dump()

    if "treatment_goals" in provided and payload.treatment_goals is not None:
        current = list(row.treatment_goals or [])
        if list(payload.treatment_goals) != current:
            row.proposed_treatment_goals = list(payload.treatment_goals)

    pending = has_pending_proposal(row)
    row.constraints_status = "pending_doctor_review" if pending else (
        getattr(row, "constraints_status", None) or "confirmed"
    )
    if not pending:
        row.constraints_status = "confirmed"
    return pending


def apply_approved_proposals(row: Profile) -> None:
    """Copy proposed_* onto effective columns and clear proposals."""
    if row.proposed_target_kcal is not None:
        row.target_kcal = row.proposed_target_kcal

    if row.proposed_restrictions is not None:
        merged = dict(row.restrictions or {})
        for key, value in dict(row.proposed_restrictions).items():
            if value is None:
                merged.pop(key, None)
            else:
                merged[key] = value
        row.restrictions = merged

    if row.proposed_treatment_goals is not None:
        row.treatment_goals = list(row.proposed_treatment_goals)

    clear_proposals(row)
    row.constraints_status = "confirmed"


def confirm_doctor_override(row: Profile) -> None:
    """Doctor wrote effective constraints directly — discard any patient proposal."""
    clear_proposals(row)
    row.constraints_status = "confirmed"
