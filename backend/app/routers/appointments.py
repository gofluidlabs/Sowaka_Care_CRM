from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..booking import AppointmentIn, PaymentIn, book_appointment, record_payment
from ..database import get_db
from ..models import (
    APPOINTMENT_STATUSES,
    CANCELLED,
    COMPLETED,
    DOCTOR,
    FRONT_DESK,
    NO_SHOW,
    OWNER,
    SCHEDULED,
    WAITING,
    WITH_DOCTOR,
    Appointment,
    Doctor,
    Patient,
    Prescription,
    User,
    Visit,
)
from ..security import get_current_user, require_roles
from ..services import (
    appointment_out,
    doctor_for,
    get_appointment_for,
    get_patient_for,
    log_activity,
    patient_out,
    visit_out,
)

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

ALLOWED_STATUS_CHANGES = {
    FRONT_DESK: {SCHEDULED, WAITING, CANCELLED, NO_SHOW},
    DOCTOR: {WAITING, WITH_DOCTOR, COMPLETED, NO_SHOW},
    OWNER: set(APPOINTMENT_STATUSES),
}
STATUS_VERBS = {
    SCHEDULED: "moved back to scheduled",
    WAITING: "marked arrived",
    WITH_DOCTOR: "started consultation for",
    COMPLETED: "completed consultation for",
    CANCELLED: "cancelled appointment for",
    NO_SHOW: "marked no-show for",
}


class NewAppointment(AppointmentIn):
    patient_id: int
    payment: Optional[PaymentIn] = None


class StatusIn(BaseModel):
    status: str


class RescheduleIn(BaseModel):
    doctor_id: Optional[int] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class PrescriptionIn(BaseModel):
    medicine: str = Field(min_length=1)
    dosage: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None


class ConsultationIn(BaseModel):
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    vitals: Optional[str] = None
    follow_up_date: Optional[date] = None
    book_follow_up: bool = False
    follow_up_time: str = "10:00"
    prescriptions: list[PrescriptionIn] = []
    complete: bool = False


@router.get("")
def list_appointments(
    day: Optional[date] = Query(None, alias="date"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    doctor_id: Optional[int] = None,
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    limit: int = 300,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Appointment)
    if user.role == DOCTOR:
        q = q.where(Appointment.doctor_id == doctor_for(db, user).id)
    elif doctor_id:
        q = q.where(Appointment.doctor_id == doctor_id)
    if day:
        q = q.where(Appointment.appointment_date == day)
    if date_from:
        q = q.where(Appointment.appointment_date >= date_from)
    if date_to:
        q = q.where(Appointment.appointment_date <= date_to)
    if status:
        q = q.where(Appointment.status.in_(status.split(",")))
    if patient_id:
        q = q.where(Appointment.patient_id == patient_id)
    q = q.order_by(Appointment.appointment_date.desc() if not day else Appointment.appointment_date,
                   Appointment.appointment_time).limit(min(limit, 1000))
    return [appointment_out(a) for a in db.scalars(q)]


@router.post("", status_code=201)
def create_appointment(
    body: NewAppointment, db: Session = Depends(get_db), user: User = Depends(require_roles(OWNER, FRONT_DESK))
):
    patient = db.get(Patient, body.patient_id)
    if patient is None:
        raise HTTPException(404, "Patient not found")
    appt = book_appointment(db, user, patient, body)
    if body.payment:
        record_payment(db, user, patient, appt, body.payment)
    db.commit()
    db.refresh(appt)
    return appointment_out(appt)


@router.patch("/{appointment_id}/status")
def change_status(
    appointment_id: int, body: StatusIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    appt = get_appointment_for(db, user, appointment_id)
    if body.status not in APPOINTMENT_STATUSES:
        raise HTTPException(400, "Invalid status")
    if body.status not in ALLOWED_STATUS_CHANGES[user.role]:
        raise HTTPException(403, "You cannot set this status")
    if appt.status == COMPLETED and user.role != OWNER:
        raise HTTPException(400, "This visit is already completed")
    if body.status == appt.status:
        return appointment_out(appt)

    now = datetime.now()
    appt.status = body.status
    if body.status == WAITING and appt.arrived_at is None:
        appt.arrived_at = now
    if body.status == COMPLETED:
        appt.completed_at = now
    action = "appointment.arrived" if body.status == WAITING else f"appointment.{body.status}"
    log_activity(
        db, user, action, f"{user.name} {STATUS_VERBS[body.status]} {appt.patient.name}",
        "patient", appt.patient_id, appt.patient.patient_code,
    )
    db.commit()
    return appointment_out(appt)


@router.patch("/{appointment_id}")
def reschedule(
    appointment_id: int,
    body: RescheduleIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(OWNER, FRONT_DESK)),
):
    appt = get_appointment_for(db, user, appointment_id)
    if appt.status in (COMPLETED, WITH_DOCTOR):
        raise HTTPException(400, "Cannot reschedule a visit that has started or completed")
    if body.doctor_id and body.doctor_id != appt.doctor_id:
        doctor = db.get(Doctor, body.doctor_id)
        if doctor is None or doctor.user.status != "active":
            raise HTTPException(400, "Selected doctor is not available")
        appt.doctor = doctor
    if body.appointment_date:
        appt.appointment_date = body.appointment_date
    if body.appointment_time:
        appt.appointment_time = body.appointment_time
    if appt.status in (CANCELLED, NO_SHOW):
        appt.status = SCHEDULED
    log_activity(
        db, user, "appointment.rescheduled",
        f"{user.name} updated {appt.patient.name}'s appointment ({appt.doctor.user.name}, "
        f"{appt.appointment_date.strftime('%d %b')} {appt.appointment_time})",
        "patient", appt.patient_id, appt.patient.patient_code,
    )
    db.commit()
    return appointment_out(appt)


@router.get("/{appointment_id}/consultation")
def get_consultation(
    appointment_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(OWNER, DOCTOR))
):
    appt = get_appointment_for(db, user, appointment_id)
    patient = get_patient_for(db, user, appt.patient_id)
    previous = db.scalars(
        select(Visit)
        .where(Visit.patient_id == patient.id, Visit.id != (appt.visit.id if appt.visit else -1))
        .order_by(Visit.created_at.desc())
        .limit(20)
    ).all()
    return {
        "appointment": appointment_out(appt),
        "patient": patient_out(patient, clinical=True),
        "visit": visit_out(appt.visit) if appt.visit else None,
        "previous_visits": [visit_out(v) for v in previous],
    }


@router.post("/{appointment_id}/consultation")
def save_consultation(
    appointment_id: int,
    body: ConsultationIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(DOCTOR)),
):
    appt = get_appointment_for(db, user, appointment_id)
    if appt.status in (CANCELLED, NO_SHOW):
        raise HTTPException(400, "This appointment was cancelled / marked no-show")
    patient = appt.patient
    visit = appt.visit
    is_new = visit is None
    if is_new:
        visit = Visit(patient_id=patient.id, doctor_id=appt.doctor_id, appointment=appt)
        db.add(visit)
    had_rx = bool(visit.prescriptions)
    visit.diagnosis = body.diagnosis
    visit.notes = body.notes
    visit.vitals = body.vitals
    visit.follow_up_date = body.follow_up_date
    visit.updated_at = datetime.now()
    visit.prescriptions = [Prescription(**rx.model_dump()) for rx in body.prescriptions if rx.medicine.strip()]

    if appt.status in (SCHEDULED, WAITING):
        appt.status = WITH_DOCTOR
        appt.arrived_at = appt.arrived_at or datetime.now()

    code = patient.patient_code
    if body.prescriptions and not had_rx:
        log_activity(db, user, "prescription.added", f"{user.name} added a prescription for {patient.name}", "patient", patient.id, code)
    elif body.prescriptions and had_rx:
        log_activity(db, user, "prescription.updated", f"{user.name} updated prescription for {patient.name}", "patient", patient.id, code)

    follow_up = None
    if body.complete:
        appt.status = COMPLETED
        appt.completed_at = datetime.now()
        log_activity(db, user, "appointment.completed", f"{user.name} completed consultation for {patient.name}", "patient", patient.id, code)
        if body.follow_up_date and body.book_follow_up:
            if body.follow_up_date <= date.today():
                raise HTTPException(400, "Follow-up date must be in the future")
            already = db.scalar(
                select(Appointment.id).where(
                    Appointment.patient_id == patient.id,
                    Appointment.doctor_id == appt.doctor_id,
                    Appointment.appointment_date == body.follow_up_date,
                    Appointment.status != CANCELLED,
                )
            )
            if not already:
                follow_up = book_appointment(
                    db, user, patient,
                    AppointmentIn(
                        doctor_id=appt.doctor_id,
                        appointment_date=body.follow_up_date,
                        appointment_time=body.follow_up_time,
                        visit_type="follow_up",
                        reason=f"Follow-up: {body.diagnosis}" if body.diagnosis else "Follow-up",
                    ),
                )
    elif is_new:
        log_activity(db, user, "consultation.saved", f"{user.name} saved consultation notes for {patient.name}", "patient", patient.id, code)

    db.commit()
    db.refresh(appt)
    return {
        "appointment": appointment_out(appt),
        "visit": visit_out(appt.visit),
        "follow_up": appointment_out(follow_up) if follow_up else None,
    }
