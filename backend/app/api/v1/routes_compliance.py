"""Patient compliance routes — contract api-v1 §10 GET /compliance/me."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.doctor import PatientComplianceOut
from app.services.compliance import ComplianceService

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/me", response_model=PatientComplianceOut)
def get_my_compliance(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> PatientComplianceOut:
    """Patient self-service compliance summary — same service as doctor route."""
    return ComplianceService(db).get_patient_compliance(user.id, days=days)
