"""Appointment booking and payment recording shared by the registration and appointment flows."""
import re
from datetime import date, datetime
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .models import SCHEDULED, WAITING, Appointment, Doctor, Patient, Payment, User
from .services import log_activity

PAYMENT_METHODS = ("cash", "upi", "card", "other")


class AppointmentIn(BaseModel):
    doctor_id: int
    appointment_date: date
    appointment_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    department: Optional[str] = None
    visit_type: str = "consultation"
    reason: Optional[str] = None
    fee: Optional[float] = None  # defaults to the doctor's consultation fee
    mark_arrived: bool = False  # patient is at the desk right now → straight into the queue


class PaymentIn(BaseModel):
    amount: float = Field(ge=0)
    payment_method: str = "cash"
    note: Optional[str] = None


def book_appointment(db: Session, user: User, patient: Patient, body: AppointmentIn) -> Appointment:
    doctor = db.get(Doctor, body.doctor_id)
    if doctor is None or doctor.user.status != "active":
        raise HTTPException(400, "Selected doctor is not available")
    hh, mm = (int(x) for x in body.appointment_time.split(":"))
    if not (0 <= hh < 24 and 0 <= mm < 60):
        raise HTTPException(400, "Invalid appointment time")
    arrived = body.mark_arrived and body.appointment_date == date.today()
    appt = Appointment(
        patient=patient,
        doctor=doctor,
        appointment_date=body.appointment_date,
        appointment_time=body.appointment_time,
        department=body.department or doctor.department,
        visit_type=body.visit_type,
        reason=body.reason,
        fee=doctor.consultation_fee if body.fee is None else body.fee,
        status=WAITING if arrived else SCHEDULED,
        arrived_at=datetime.now() if arrived else None,
        created_by=user.id,
    )
    db.add(appt)
    if patient.primary_doctor_id is None:
        patient.primary_doctor_id = doctor.id
    db.flush()
    when = "today" if body.appointment_date == date.today() else body.appointment_date.strftime("%d %b")
    log_activity(
        db, user, "appointment.created",
        f"{user.name} booked {patient.name} with {doctor.user.name} ({when} {body.appointment_time})",
        "patient", patient.id, patient.patient_code,
    )
    return appt


def record_payment(
    db: Session, user: User, patient: Patient, appointment: Optional[Appointment], body: PaymentIn
) -> Optional[Payment]:
    if body.amount <= 0:
        return None
    if body.payment_method not in PAYMENT_METHODS:
        raise HTTPException(400, "Invalid payment method")
    payment = Payment(
        patient=patient,
        appointment=appointment,
        amount=body.amount,
        payment_method=body.payment_method,
        note=body.note,
        created_by=user.id,
    )
    db.add(payment)
    db.flush()
    log_activity(
        db, user, "payment.recorded",
        f"{user.name} recorded ₹{body.amount:,.0f} ({body.payment_method.upper()}) from {patient.name}",
        "patient", patient.id, patient.patient_code,
    )
    return payment


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"[^\d+]", "", phone)
    if len(digits) < 7:
        raise HTTPException(400, "Please enter a valid mobile number")
    return digits
