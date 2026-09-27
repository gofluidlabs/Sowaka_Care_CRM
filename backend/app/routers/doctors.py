from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    CANCELLED,
    COMPLETED,
    NO_SHOW,
    OPEN_STATUSES,
    OWNER,
    ActivityLog,
    Appointment,
    Doctor,
    Payment,
    User,
)
from ..security import get_current_user, require_roles
from ..services import activity_out, appointment_out, day_bounds, doctor_out

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


def doctor_day_stats(db: Session, day: date) -> dict[int, dict]:
    rows = db.execute(
        select(Appointment.doctor_id, Appointment.status, func.count())
        .where(Appointment.appointment_date == day)
        .group_by(Appointment.doctor_id, Appointment.status)
    ).all()
    stats: dict[int, dict] = {}
    for doctor_id, status, n in rows:
        s = stats.setdefault(doctor_id, {"patients": 0, "completed": 0, "pending": 0, "waiting": 0, "cancelled": 0})
        if status in (CANCELLED, NO_SHOW):
            s["cancelled"] += n
            continue
        s["patients"] += n
        if status == COMPLETED:
            s["completed"] += n
        elif status in OPEN_STATUSES:
            s["pending"] += n
            if status == "waiting":
                s["waiting"] += n
    return stats


@router.get("")
def list_doctors(
    include_inactive: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    q = select(Doctor).join(User).order_by(User.name)
    if not (include_inactive and user.role == OWNER):
        q = q.where(User.status == "active", User.role == "doctor")
    doctors = db.scalars(q).all()
    empty = {"patients": 0, "completed": 0, "pending": 0, "waiting": 0, "cancelled": 0}
    stats = doctor_day_stats(db, date.today())
    return [doctor_out(d) | {"today": stats.get(d.id, empty)} for d in doctors]


@router.get("/{doctor_id}")
def doctor_detail(doctor_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(OWNER))):
    doc = db.get(Doctor, doctor_id)
    if doc is None:
        raise HTTPException(404, "Doctor not found")
    today = date.today()
    month_start = today - timedelta(days=29)

    todays = db.scalars(
        select(Appointment)
        .where(Appointment.doctor_id == doc.id, Appointment.appointment_date == today)
        .order_by(Appointment.appointment_time)
    ).all()

    def distinct_patients(since: date) -> int:
        return db.scalar(
            select(func.count(func.distinct(Appointment.patient_id))).where(
                Appointment.doctor_id == doc.id,
                Appointment.appointment_date.between(since, today),
                Appointment.status.notin_([CANCELLED, NO_SHOW]),
            )
        ) or 0

    revenue_month = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Appointment, Payment.appointment_id == Appointment.id)
        .where(Appointment.doctor_id == doc.id, Payment.created_at >= day_bounds(month_start)[0])
    )
    completed_month = db.scalar(
        select(func.count()).where(
            Appointment.doctor_id == doc.id,
            Appointment.status == COMPLETED,
            Appointment.appointment_date.between(month_start, today),
        )
    )
    activity = db.scalars(
        select(ActivityLog)
        .where(ActivityLog.user_id == doc.user_id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(25)
    ).all()
    empty = {"patients": 0, "completed": 0, "pending": 0, "waiting": 0, "cancelled": 0}
    return {
        "doctor": doctor_out(doc) | {"last_login": doc.user.last_login.isoformat() if doc.user.last_login else None},
        "today": doctor_day_stats(db, today).get(doc.id, empty),
        "today_appointments": [appointment_out(a) for a in todays],
        "patients_week": distinct_patients(today - timedelta(days=6)),
        "patients_month": distinct_patients(month_start),
        "completed_month": completed_month,
        "revenue_month": float(revenue_month or 0),
        "activity": [activity_out(a) for a in activity],
    }
