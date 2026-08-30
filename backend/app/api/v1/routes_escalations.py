"""Chat escalation routes — patient create/reply + doctor inbox thread."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.escalation import (
    EscalationCreate,
    EscalationListItem,
    EscalationMessageIn,
    EscalationOut,
)
from app.services import escalation_service

patient_router = APIRouter(prefix="/chat/escalations", tags=["chat-escalations"])
doctor_router = APIRouter(prefix="/doctor/escalations", tags=["doctor-escalations"])


@patient_router.post("", response_model=EscalationOut, status_code=status.HTTP_201_CREATED)
def create_escalation(
    payload: EscalationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> EscalationOut:
    return escalation_service.create_escalation(db, user, payload)


@patient_router.get("/{escalation_id}", response_model=EscalationOut)
def get_escalation(
    escalation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> EscalationOut:
    return escalation_service.get_patient_escalation(db, user, escalation_id)


@patient_router.post("/{escalation_id}/messages", response_model=EscalationOut)
def add_patient_message(
    escalation_id: str,
    payload: EscalationMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> EscalationOut:
    return escalation_service.add_patient_message(db, user, escalation_id, payload.body)


@doctor_router.get("", response_model=list[EscalationListItem])
def list_escalations(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[EscalationListItem]:
    return escalation_service.list_doctor_escalations(db, user, status=status)


@doctor_router.get("/{escalation_id}", response_model=EscalationOut)
def get_doctor_escalation(
    escalation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> EscalationOut:
    return escalation_service.get_doctor_escalation(db, user, escalation_id)


@doctor_router.post("/{escalation_id}/messages", response_model=EscalationOut)
def add_doctor_message(
    escalation_id: str,
    payload: EscalationMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> EscalationOut:
    return escalation_service.add_doctor_message(db, user, escalation_id, payload.body)


@doctor_router.post("/{escalation_id}/resolve", response_model=EscalationOut)
def resolve_escalation(
    escalation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> EscalationOut:
    return escalation_service.resolve_escalation(db, user, escalation_id)
