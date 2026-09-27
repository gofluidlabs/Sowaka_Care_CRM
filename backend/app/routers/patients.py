from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..booking import AppointmentIn, PaymentIn, book_appointment, normalize_phone, record_payment
from ..database import get_db
from ..models import (
    CANCELLED,
    COMPLETED,
    DOCTOR,
    FRONT_DESK,
    NO_SHOW,
    OWNER,
    Appointment,
    Patient,
    Payment,
    User,
    Visit,
)
from ..security import get_current_user, require_roles
from ..services import (
    appointment_out,
    doctor_for,
    doctor_patient_filter,
    get_patient_for,
    log_activity,
    patient_out,
    payment_out,
    visit_out,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientBase(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[date] = None
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_group: Optional[str] = None


class PatientCreate(PatientBase):
    name: str = Field(min_length=2)
    phone: str
    appointment: Optional[AppointmentIn] = None
    payment: Optional[PaymentIn] = None


class PatientUpdate(PatientBase):
    medical_history: Optional[str] = None
    allergies: Optional[str] = None


def dob_from(body: PatientBase) -> Optional[date]:
    if body.dob:
        return body.dob
    if body.age is not None:
        today = date.today()
        try:
            return today.replace(year=today.year - body.age)
        except ValueError:  # 29 Feb
            return today.replace(year=today.year - body.age, day=28)
    return None


@router.get("")
def list_patients(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Patient)
    if user.role == DOCTOR:
        query = query.where(doctor_patient_filter(doctor_for(db, user).id))
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Patient.name).like(term),
                Patient.phone.like(term),
                func.lower(Patient.patient_code).like(term),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    patients = db.scalars(query.order_by(Patient.created_at.desc()).offset(offset).limit(min(limit, 200))).all()

    # Last visit per patient on this page
    last_visits = {}
    if patients:
        last_q = (
            select(Appointment.patient_id, func.max(Appointment.appointment_date))
            .where(Appointment.patient_id.in_([p.id for p in patients]), Appointment.status.notin_([CANCELLED, NO_SHOW]))
            .group_by(Appointment.patient_id)
        )
        if user.role == DOCTOR:
            last_q = last_q.where(Appointment.doctor_id == doctor_for(db, user).id)
        last_visits = dict(db.execute(last_q).all())

    return {
        "total": total,
        "items": [patient_out(p) | {"last_visit": (lv.isoformat() if (lv := last_visits.get(p.id)) else None)} for p in patients],
    }


@router.post("", status_code=201)
def register_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(OWNER, FRONT_DESK)),
):
    patient = Patient(
        name=body.name.strip(),
        phone=normalize_phone(body.phone),
        dob=dob_from(body),
        gender=body.gender,
        address=body.address,
        emergency_contact_name=body.emergency_contact_name,
        emergency_contact_phone=body.emergency_contact_phone,
        blood_group=body.blood_group,
        created_by=user.id,
    )
    db.add(patient)
    db.flush()
    patient.patient_code = f"PAT-{datetime.now().year}-{patient.id:05d}"
    log_activity(
        db, user, "patient.registered", f"{user.name} registered a new patient — {patient.name}",
        "patient", patient.id, patient.patient_code,
    )
    appointment = None
    if body.appointment:
        appointment = book_appointment(db, user, patient, body.appointment)
    if body.payment:
        record_payment(db, user, patient, appointment, body.payment)
    db.commit()
    return {
        "patient": patient_out(patient),
        "appointment": appointment_out(appointment) if appointment else None,
    }


@router.get("/{patient_id}")
def patient_profile(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    patient = get_patient_for(db, user, patient_id)
    clinical = user.role in (OWNER, DOCTOR)
    financial = user.role in (OWNER, FRONT_DESK)

    appointments = db.scalars(
        select(Appointment)
        .where(Appointment.patient_id == patient.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.appointment_time.desc())
    ).all()
    visits = (
        db.scalars(select(Visit).where(Visit.patient_id == patient.id).order_by(Visit.created_at.desc())).all()
        if clinical
        else []
    )
    payments = (
        db.scalars(select(Payment).where(Payment.patient_id == patient.id).order_by(Payment.created_at.desc())).all()
        if financial
        else []
    )

    # Chronological timeline (newest first)
    timeline = [{
        "at": patient.created_at.isoformat(),
        "type": "registration",
        "title": "Registration",
        "detail": f"Registered by {patient.creator.name}" if patient.creator else "Registered",
    }]
    for a in appointments:
        at = datetime.combine(a.appointment_date, datetime.strptime(a.appointment_time, "%H:%M").time())
        label = a.visit_type.replace("_", " ").title()
        if a.status == COMPLETED and clinical and a.visit:
            continue  # shown via the visit entry
        status_text = {
            "scheduled": "Appointment booked",
            "waiting": "Arrived — waiting",
            "with_doctor": "With doctor",
            "completed": "Visit completed",
            "cancelled": "Appointment cancelled",
            "no_show": "No-show",
        }[a.status]
        timeline.append({
            "at": at.isoformat(),
            "type": "appointment",
            "status": a.status,
            "title": label,
            "detail": f"{status_text} · {a.doctor.user.name}",
        })
    for v in visits:
        extras = []
        if v.diagnosis:
            extras.append(f"Diagnosis: {v.diagnosis}")
        if v.prescriptions:
            extras.append(f"Prescription added ({len(v.prescriptions)} item{'s' if len(v.prescriptions) != 1 else ''})")
        if v.follow_up_date:
            extras.append(f"Follow-up {v.follow_up_date.strftime('%d %b %Y')}")
        timeline.append({
            "at": v.created_at.isoformat(),
            "type": "visit",
            "title": v.appointment.visit_type.replace("_", " ").title() if v.appointment else "Consultation",
            "detail": " · ".join([v.doctor.user.name, *extras]),
        })
    for p in payments:
        timeline.append({
            "at": p.created_at.isoformat(),
            "type": "payment",
            "title": "Payment",
            "detail": f"₹{p.amount:,.0f} via {p.payment_method.upper()}" + (f" · {p.creator.name}" if p.creator else ""),
        })
    timeline.sort(key=lambda e: e["at"], reverse=True)

    return {
        "patient": patient_out(patient, clinical=clinical),
        "appointments": [appointment_out(a) for a in appointments],
        "visits": [visit_out(v) for v in visits],
        "payments": [payment_out(p) for p in payments],
        "timeline": timeline,
        "permissions": {"clinical": clinical, "financial": financial},
    }


@router.patch("/{patient_id}")
def update_patient(
    patient_id: int, body: PatientUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    patient = get_patient_for(db, user, patient_id)
    data = body.model_dump(exclude_unset=True)
    basic = {"name", "phone", "dob", "age", "gender", "address", "emergency_contact_name", "emergency_contact_phone", "blood_group"}
    clinical = {"medical_history", "allergies", "blood_group"}
    allowed = basic | clinical if user.role == OWNER else basic if user.role == FRONT_DESK else clinical
    blocked = set(data) - allowed
    if blocked:
        raise HTTPException(403, f"You cannot edit: {', '.join(sorted(blocked))}")

    if "phone" in data:
        data["phone"] = normalize_phone(data["phone"])
    if "age" in data or "dob" in data:
        data["dob"] = dob_from(body)
        data.pop("age", None)
    for key, value in data.items():
        setattr(patient, key, value)
    log_activity(
        db, user, "patient.updated", f"{user.name} updated {patient.name}'s details",
        "patient", patient.id, patient.patient_code,
    )
    db.commit()
    return patient_out(patient, clinical=user.role in (OWNER, DOCTOR))
