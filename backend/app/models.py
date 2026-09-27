from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Roles
OWNER = "owner"
DOCTOR = "doctor"
FRONT_DESK = "front_desk"
ROLES = (OWNER, DOCTOR, FRONT_DESK)

# Appointment statuses
SCHEDULED = "scheduled"
WAITING = "waiting"
WITH_DOCTOR = "with_doctor"
COMPLETED = "completed"
CANCELLED = "cancelled"
NO_SHOW = "no_show"
APPOINTMENT_STATUSES = (SCHEDULED, WAITING, WITH_DOCTOR, COMPLETED, CANCELLED, NO_SHOW)
OPEN_STATUSES = (SCHEDULED, WAITING, WITH_DOCTOR)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[Optional[str]] = mapped_column(String(160))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)
    designation: Mapped[Optional[str]] = mapped_column(String(60))  # e.g. Receptionist, Nurse
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | inactive
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_active: Mapped[Optional[datetime]] = mapped_column(DateTime)

    doctor: Mapped[Optional["Doctor"]] = relationship(back_populates="user", uselist=False)


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    code: Mapped[Optional[str]] = mapped_column(String(20), unique=True)  # DOC-001
    specialization: Mapped[Optional[str]] = mapped_column(String(120))
    department: Mapped[Optional[str]] = mapped_column(String(120))
    consultation_fee: Mapped[float] = mapped_column(Float, default=500)

    user: Mapped[User] = relationship(back_populates="doctor")

    @property
    def name(self) -> str:
        return self.user.name


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_code: Mapped[Optional[str]] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    dob: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(120))
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    blood_group: Mapped[Optional[str]] = mapped_column(String(5))
    # Clinical fields: visible to doctors and owner only
    medical_history: Mapped[Optional[str]] = mapped_column(Text)
    allergies: Mapped[Optional[str]] = mapped_column(Text)
    primary_doctor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("doctors.id"))
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    primary_doctor: Mapped[Optional[Doctor]] = relationship()
    creator: Mapped[Optional[User]] = relationship()


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    appointment_date: Mapped[date] = mapped_column(Date, index=True)
    appointment_time: Mapped[str] = mapped_column(String(5))  # HH:MM
    department: Mapped[Optional[str]] = mapped_column(String(120))
    visit_type: Mapped[str] = mapped_column(String(30), default="consultation")
    reason: Mapped[Optional[str]] = mapped_column(Text)
    fee: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(20), default=SCHEDULED, index=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    arrived_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    patient: Mapped[Patient] = relationship()
    doctor: Mapped[Doctor] = relationship()
    creator: Mapped[Optional[User]] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="appointment")
    visit: Mapped[Optional["Visit"]] = relationship(back_populates="appointment", uselist=False)

    @property
    def amount_paid(self) -> float:
        return sum(p.amount for p in self.payments)

    @property
    def payment_status(self) -> str:
        paid = self.amount_paid
        if self.fee <= 0 or paid >= self.fee:
            return "paid"
        return "partial" if paid > 0 else "pending"


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    appointment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("appointments.id"), unique=True)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    vitals: Mapped[Optional[str]] = mapped_column(String(200))
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    doctor: Mapped[Doctor] = relationship()
    appointment: Mapped[Optional[Appointment]] = relationship(back_populates="visit")
    prescriptions: Mapped[list["Prescription"]] = relationship(
        back_populates="visit", cascade="all, delete-orphan"
    )


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    medicine: Mapped[str] = mapped_column(String(160))
    dosage: Mapped[Optional[str]] = mapped_column(String(80))
    duration: Mapped[Optional[str]] = mapped_column(String(80))
    instructions: Mapped[Optional[str]] = mapped_column(String(255))

    visit: Mapped[Visit] = relationship(back_populates="prescriptions")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    appointment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("appointments.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    payment_method: Mapped[str] = mapped_column(String(20), default="cash")  # cash | upi | card | other
    status: Mapped[str] = mapped_column(String(20), default="received")
    note: Mapped[Optional[str]] = mapped_column(String(255))
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

    patient: Mapped[Patient] = relationship()
    appointment: Mapped[Optional[Appointment]] = relationship(back_populates="payments")
    creator: Mapped[Optional[User]] = relationship()


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[str] = mapped_column(String(255))
    entity_type: Mapped[Optional[str]] = mapped_column(String(30))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    entity_label: Mapped[Optional[str]] = mapped_column(String(60))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

    user: Mapped[Optional[User]] = relationship()
