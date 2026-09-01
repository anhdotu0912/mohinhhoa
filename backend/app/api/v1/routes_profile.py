"""Profile routes — contract §1.1."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import PatientProfile, ProfileUpsert
from app.services.clinical_constraints import store_patient_proposals
from app.services.meal_plan_service import get_profile

router = APIRouter(prefix="/profile", tags=["profile"])


def _invalidate_profile_cache(user_id: str) -> None:
    from app.core.cache import profile_cache

    profile_cache.invalidate(user_id)


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
    row.preferences = payload.preferences
    store_patient_proposals(row, payload)
    db.commit()

    _invalidate_profile_cache(user.id)
    return get_profile(db, user.id)


@router.get("/me", response_model=PatientProfile)
def get_my_profile(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> PatientProfile:
    return get_profile(db, user.id)
