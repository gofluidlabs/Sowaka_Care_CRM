"""Shared helpers: activity logging, role-based access checks and serializers."""
from datetime import date, datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from .models import (
    DOCTOR,
    FRONT_DESK,
    OWNER,
    ActivityLog,
    Appointment,
    Doctor,
    Patient,
    Payment,
    User,
    Visit,
)


# ---------------------------------------------------------------- activity

def log_activity(
    db: Session,
    user: Optional[User],
    action: str,
    description: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_label: Optional[str] = None,
) -> None:
    db.add(
        ActivityLog(
            user_id=user.id if user else None,
            action=action,
            description=description,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
        )
    )


# ---------------------------------------------------------------- access

def doctor_for(db: Session, user: User) -> Doctor:
    doc = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
    if doc is None:
        raise HTTPException(400, "Doctor profile not found for this account")
    return doc


def doctor_patient_filter(doctor_id: int):
    """Patients a doctor may see: their primary patients, or anyone with an appointment with them."""
    return or_(
        Patient.primary_doctor_id == doctor_id,
        exists().where(Appointment.patient_id == Patient.id, Appointment.doctor_id == doctor_id),
    )


def get_patient_for(db: Session, user: User, patient_id: int) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(404, "Patient not found")
    if user.role == DOCTOR:
        doc = doctor_for(db, user)
        allowed = db.scalar(
            select(Patient.id).where(Patient.id == patient_id, doctor_patient_filter(doc.id))
        )
        if not allowed:
            raise HTTPException(403, "This patient is not assigned to you")
    return patient


def get_appointment_for(db: Session, user: User, appointment_id: int) -> Appointment:
    appt = db.get(Appointment, appointment_id)
    if appt is None:
        raise HTTPException(404, "Appointment not found")
    if user.role == DOCTOR and appt.doctor_id != doctor_for(db, user).id:
        raise HTTPException(403, "This appointment is not assigned to you")
    return appt


# ---------------------------------------------------------------- serializers

def age_from_dob(dob: Optional[date]) -> Optional[int]:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def user_out(u: User) -> dict:
    data = {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "username": u.username,
        "role": u.role,
        "designation": u.designation,
        "status": u.status,
        "must_change_password": u.must_change_password,
        "created_at": iso(u.created_at),
        "last_login": iso(u.last_login),
        "last_active": iso(u.last_active),
        "doctor": None,
    }
    if u.doctor:
        data["doctor"] = {
            "id": u.doctor.id,
            "code": u.doctor.code,
            "specialization": u.doctor.specialization,
            "department": u.doctor.department,
            "consultation_fee": u.doctor.consultation_fee,
        }
    return data


def doctor_out(d: Doctor) -> dict:
    return {
        "id": d.id,
        "user_id": d.user_id,
        "code": d.code,
        "name": d.user.name,
        "specialization": d.specialization,
        "department": d.department,
        "consultation_fee": d.consultation_fee,
        "phone": d.user.phone,
        "email": d.user.email,
        "status": d.user.status,
        "last_active": iso(d.user.last_active),
    }


def patient_out(p: Patient, clinical: bool = False) -> dict:
    data = {
        "id": p.id,
        "patient_code": p.patient_code,
        "name": p.name,
        "phone": p.phone,
        "dob": iso(p.dob),
        "age": age_from_dob(p.dob),
        "gender": p.gender,
        "address": p.address,
        "emergency_contact_name": p.emergency_contact_name,
        "emergency_contact_phone": p.emergency_contact_phone,
        "blood_group": p.blood_group,
        "primary_doctor_id": p.primary_doctor_id,
        "primary_doctor_name": p.primary_doctor.user.name if p.primary_doctor else None,
        "created_at": iso(p.created_at),
        "created_by_name": p.creator.name if p.creator else None,
    }
    if clinical:
        data["medical_history"] = p.medical_history
        data["allergies"] = p.allergies
    return data


def appointment_out(a: Appointment) -> dict:
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": a.patient.name,
        "patient_code": a.patient.patient_code,
        "patient_phone": a.patient.phone,
        "patient_age": age_from_dob(a.patient.dob),
        "patient_gender": a.patient.gender,
        "doctor_id": a.doctor_id,
        "doctor_name": a.doctor.user.name,
        "department": a.department or a.doctor.department,
        "appointment_date": iso(a.appointment_date),
        "appointment_time": a.appointment_time,
        "visit_type": a.visit_type,
        "reason": a.reason,
        "status": a.status,
        "fee": a.fee,
        "amount_paid": a.amount_paid,
        "payment_status": a.payment_status,
        "has_visit": a.visit is not None,
        "created_by_name": a.creator.name if a.creator else None,
        "created_at": iso(a.created_at),
        "arrived_at": iso(a.arrived_at),
        "completed_at": iso(a.completed_at),
    }


def visit_out(v: Visit) -> dict:
    return {
        "id": v.id,
        "patient_id": v.patient_id,
        "doctor_id": v.doctor_id,
        "doctor_name": v.doctor.user.name,
        "appointment_id": v.appointment_id,
        "visit_type": v.appointment.visit_type if v.appointment else "consultation",
        "diagnosis": v.diagnosis,
        "notes": v.notes,
        "vitals": v.vitals,
        "follow_up_date": iso(v.follow_up_date),
        "created_at": iso(v.created_at),
        "updated_at": iso(v.updated_at),
        "prescriptions": [
            {
                "id": rx.id,
                "medicine": rx.medicine,
                "dosage": rx.dosage,
                "duration": rx.duration,
                "instructions": rx.instructions,
            }
            for rx in v.prescriptions
        ],
    }


def payment_out(p: Payment) -> dict:
    return {
        "id": p.id,
        "patient_id": p.patient_id,
        "patient_name": p.patient.name,
        "patient_code": p.patient.patient_code,
        "appointment_id": p.appointment_id,
        "doctor_name": p.appointment.doctor.user.name if p.appointment else None,
        "amount": p.amount,
        "payment_method": p.payment_method,
        "status": p.status,
        "note": p.note,
        "created_by_name": p.creator.name if p.creator else None,
        "created_at": iso(p.created_at),
    }


def activity_out(a: ActivityLog) -> dict:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "user_name": a.user.name if a.user else "System",
        "user_role": a.user.role if a.user else None,
        "action": a.action,
        "description": a.description,
        "entity_type": a.entity_type,
        "entity_id": a.entity_id,
        "entity_label": a.entity_label,
        "timestamp": iso(a.timestamp),
    }


def day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, datetime.min.time())
    return start, datetime.combine(d, datetime.max.time())


ROLE_LABELS = {OWNER: "Owner", DOCTOR: "Doctor", FRONT_DESK: "Front Desk"}
