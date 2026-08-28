"""Doctor ↔ patient 1–1 assignment, claim queue, and transfers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import hash_password
from app.models.patient_transfer import PatientTransfer
from app.models.user import User


def require_patient(db: Session, patient_id: str) -> User:
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")
    return patient


def require_assigned_patient(db: Session, doctor: User, patient_id: str) -> User:
    patient = require_patient(db, patient_id)
    if patient.assigned_doctor_id != doctor.id:
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")
    return patient


def assigned_patient_ids(db: Session, doctor_id: str) -> list[str]:
    rows = (
        db.query(User.id)
        .filter(User.role == "patient", User.assigned_doctor_id == doctor_id)
        .all()
    )
    return [row[0] for row in rows]


def list_assigned_patients(db: Session, doctor_id: str) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == "patient", User.assigned_doctor_id == doctor_id)
        .order_by(User.created_at.desc())
        .all()
    )


def display_doctor_name(user: User | None) -> str | None:
    if user is None:
        return None
    if user.full_name and user.full_name.strip():
        return user.full_name.strip()
    local = (user.email or "bac-si").split("@")[0]
    return local.replace(".", " ").replace("_", " ").strip().title() or "Bác sĩ"


def pending_transfer_for_patient(db: Session, patient_id: str) -> PatientTransfer | None:
    return (
        db.query(PatientTransfer)
        .filter(
            PatientTransfer.patient_id == patient_id,
            PatientTransfer.status == "pending",
        )
        .order_by(PatientTransfer.created_at.desc())
        .first()
    )


def cancel_pending_transfers(db: Session, patient_id: str, *, except_id: str | None = None) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    q = db.query(PatientTransfer).filter(
        PatientTransfer.patient_id == patient_id,
        PatientTransfer.status == "pending",
    )
    if except_id:
        q = q.filter(PatientTransfer.id != except_id)
    for row in q.all():
        row.status = "cancelled"
        row.resolved_at = now


def create_patient_for_doctor(db: Session, doctor: User, *, email: str, password: str, full_name: str | None) -> User:
    normalized = email.strip().lower()
    if db.query(User).filter(User.email == normalized).first() is not None:
        raise APIError(409, "EMAIL_EXISTS", "Email đã được đăng ký.")
    patient = User(
        email=normalized,
        hashed_password=hash_password(password),
        role="patient",
        full_name=(full_name or "").strip() or None,
        assigned_doctor_id=doctor.id,
        signup_channel="doctor",
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def claim_patient(db: Session, doctor: User, patient_id: str) -> User:
    patient = require_patient(db, patient_id)
    if patient.assigned_doctor_id == doctor.id:
        return patient
    if patient.assigned_doctor_id is not None:
        raise APIError(409, "ALREADY_ASSIGNED", "Bệnh nhân đã được bác sĩ khác nhận.")
    patient.assigned_doctor_id = doctor.id
    cancel_pending_transfers(db, patient.id)
    db.commit()
    db.refresh(patient)
    return patient


def list_colleagues(db: Session, doctor_id: str) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == "doctor", User.id != doctor_id)
        .order_by(User.full_name.asc(), User.email.asc())
        .all()
    )


def request_transfer(db: Session, doctor: User, patient_id: str, to_doctor_id: str) -> PatientTransfer:
    patient = require_assigned_patient(db, doctor, patient_id)
    if to_doctor_id == doctor.id:
        raise APIError(400, "INVALID_TRANSFER", "Không thể chuyển cho chính mình.")
    target = db.get(User, to_doctor_id)
    if target is None or target.role != "doctor":
        raise APIError(404, "DOCTOR_NOT_FOUND", "Không tìm thấy bác sĩ nhận.")

    existing = pending_transfer_for_patient(db, patient.id)
    if (
        existing is not None
        and existing.to_doctor_id == to_doctor_id
        and existing.from_doctor_id == doctor.id
    ):
        return existing

    cancel_pending_transfers(db, patient.id)
    row = PatientTransfer(
        patient_id=patient.id,
        from_doctor_id=doctor.id,
        to_doctor_id=to_doctor_id,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def accept_transfer(db: Session, doctor: User, transfer_id: str) -> User:
    row = db.get(PatientTransfer, transfer_id)
    if row is None or row.to_doctor_id != doctor.id:
        raise APIError(404, "TRANSFER_NOT_FOUND", "Không tìm thấy đề xuất chuyển.")
    if row.status != "pending":
        raise APIError(409, "TRANSFER_NOT_PENDING", "Đề xuất chuyển không còn hiệu lực.")
    patient = require_patient(db, row.patient_id)
    if patient.assigned_doctor_id != row.from_doctor_id:
        row.status = "cancelled"
        row.resolved_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        raise APIError(409, "TRANSFER_NOT_PENDING", "Đề xuất chuyển không còn hiệu lực.")
    now = datetime.now(UTC).replace(tzinfo=None)
    patient.assigned_doctor_id = doctor.id
    row.status = "accepted"
    row.resolved_at = now
    cancel_pending_transfers(db, patient.id, except_id=row.id)
    db.commit()
    db.refresh(patient)
    return patient


@dataclass
class ClaimQueueRow:
    kind: str
    source: str
    patient: User
    transfer: PatientTransfer | None
    from_doctor: User | None
    created_at: datetime


def list_claim_queue(db: Session, doctor: User) -> list[ClaimQueueRow]:
    rows: list[ClaimQueueRow] = []

    unassigned = (
        db.query(User)
        .filter(User.role == "patient", User.assigned_doctor_id.is_(None))
        .order_by(User.created_at.desc())
        .all()
    )
    for patient in unassigned:
        channel = patient.signup_channel or "legacy"
        source = "self_register" if channel == "self" else "unassigned_pool"
        created = patient.created_at or datetime.now(UTC).replace(tzinfo=None)
        rows.append(
            ClaimQueueRow(
                kind="unassigned",
                source=source,
                patient=patient,
                transfer=None,
                from_doctor=None,
                created_at=created,
            )
        )

    transfers = (
        db.query(PatientTransfer)
        .filter(
            PatientTransfer.to_doctor_id == doctor.id,
            PatientTransfer.status == "pending",
        )
        .order_by(PatientTransfer.created_at.desc())
        .all()
    )
    for xfer in transfers:
        patient = db.get(User, xfer.patient_id)
        if patient is None or patient.role != "patient":
            continue
        from_doc = db.get(User, xfer.from_doctor_id)
        created = xfer.created_at or datetime.now(UTC).replace(tzinfo=None)
        rows.append(
            ClaimQueueRow(
                kind="transfer",
                source="transfer",
                patient=patient,
                transfer=xfer,
                from_doctor=from_doc,
                created_at=created,
            )
        )

    rows.sort(key=lambda r: r.created_at or datetime.min, reverse=True)
    return rows
