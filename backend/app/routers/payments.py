from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..booking import PaymentIn, record_payment
from ..database import get_db
from ..models import CANCELLED, FRONT_DESK, NO_SHOW, OWNER, Appointment, Patient, Payment, User
from ..security import require_roles
from ..services import appointment_out, day_bounds, payment_out

router = APIRouter(prefix="/api/payments", tags=["payments"])
desk_or_owner = require_roles(OWNER, FRONT_DESK)


class NewPayment(PaymentIn):
    patient_id: Optional[int] = None
    appointment_id: Optional[int] = None


@router.get("")
def list_payments(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(desk_or_owner),
):
    date_from = date_from or date.today()
    date_to = date_to or date.today()
    rows = db.scalars(
        select(Payment)
        .where(Payment.created_at.between(day_bounds(date_from)[0], day_bounds(date_to)[1]))
        .order_by(Payment.created_at.desc())
    ).all()
    return {
        "total": sum(p.amount for p in rows),
        "by_method": {m: sum(p.amount for p in rows if p.payment_method == m) for m in ("cash", "upi", "card", "other")},
        "items": [payment_out(p) for p in rows],
    }


@router.get("/dues")
def pending_dues(days: int = 30, db: Session = Depends(get_db), _: User = Depends(desk_or_owner)):
    since = date.today() - timedelta(days=days)
    appts = db.scalars(
        select(Appointment)
        .where(
            Appointment.appointment_date >= since,
            Appointment.appointment_date <= date.today(),
            Appointment.fee > 0,
            Appointment.status.notin_([CANCELLED, NO_SHOW]),
        )
        .order_by(Appointment.appointment_date.desc(), Appointment.appointment_time)
    ).all()
    return [appointment_out(a) for a in appts if a.payment_status != "paid"]


@router.post("", status_code=201)
def create_payment(body: NewPayment, db: Session = Depends(get_db), user: User = Depends(desk_or_owner)):
    appointment = db.get(Appointment, body.appointment_id) if body.appointment_id else None
    if body.appointment_id and appointment is None:
        raise HTTPException(404, "Appointment not found")
    patient = appointment.patient if appointment else db.get(Patient, body.patient_id or 0)
    if patient is None:
        raise HTTPException(400, "Select a patient or appointment")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")
    payment = record_payment(db, user, patient, appointment, body)
    db.commit()
    return {
        "payment": payment_out(payment),
        "appointment": appointment_out(appointment) if appointment else None,
    }
