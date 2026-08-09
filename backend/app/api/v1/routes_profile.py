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


@router.post("", response_model=PatientProfile)
def upsert_profile(
    payload: ProfileUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> PatientProfile:
    row = db.query(Profile).filter(Profile.user_id == user.id).first()
    if row is None:
        row = Profile(user_id=user.id)
        db.add(row)
    row.disease = payload.disease
    row.medications = payload.medications
    row.allergies = payload.allergies
    row.bmi = payload.bmi
    row.target_kcal = payload.target_kcal
    row.restrictions = payload.restrictions.model_dump()
    row.preferences = payload.preferences
    db.commit()
    return get_profile(db, user.id)


@router.get("/me", response_model=PatientProfile)
def get_my_profile(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> PatientProfile:
    return get_profile(db, user.id)
