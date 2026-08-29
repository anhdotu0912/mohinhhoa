"""Profile routes — contract §1.1."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import PatientProfile, ProfileUpsert
from app.services.meal_plan_service import get_profile

router = APIRouter(prefix="/profile", tags=["profile"])


def _restrictions_changed(old: dict | None, new: dict) -> bool:
    return dict(old or {}) != dict(new or {})


@router.post("", response_model=PatientProfile)
def upsert_profile(
    payload: ProfileUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> PatientProfile:
    row = db.query(Profile).filter(Profile.user_id == user.id).first()
    is_new = row is None
    if is_new:
        row = Profile(user_id=user.id)
        db.add(row)

    new_restrictions = payload.restrictions.model_dump()
    constraints_changed = not is_new and (
        row.target_kcal != payload.target_kcal
        or _restrictions_changed(row.restrictions, new_restrictions)
    )

    row.disease = payload.disease
    row.medications = payload.medications
    row.allergies = payload.allergies
    row.bmi = payload.bmi
    row.weight = payload.weight
    row.height = payload.height
    row.age = payload.age
    row.gender = payload.gender
    row.phone = payload.phone
    row.address = payload.address
    row.blood_pressure = payload.blood_pressure
    row.blood_glucose = payload.blood_glucose
    row.target_kcal = payload.target_kcal
    row.restrictions = new_restrictions
    row.preferences = payload.preferences
    row.treatment_goals = payload.treatment_goals
    if constraints_changed:
        row.constraints_status = "pending_doctor_review"
    elif is_new:
        row.constraints_status = "confirmed"
    db.commit()

    from app.core.cache import profile_cache
    profile_cache.invalidate(user.id)

    return get_profile(db, user.id)


@router.get("/me", response_model=PatientProfile)
def get_my_profile(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> PatientProfile:
    return get_profile(db, user.id)
