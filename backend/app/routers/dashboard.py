from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    CANCELLED,
    COMPLETED,
    DOCTOR,
    FRONT_DESK,
    NO_SHOW,
    OPEN_STATUSES,
    OWNER,
    SCHEDULED,
    WAITING,
    WITH_DOCTOR,
    ActivityLog,
    Appointment,
    Doctor,
    Patient,
    Payment,
    User,
    Visit,
)
from ..security import get_current_user, require_roles
from ..services import activity_out, appointment_out, day_bounds, doctor_for, doctor_out
from .doctors import doctor_day_stats

router = APIRouter(tags=["dashboard"])


def todays_appointments(db: Session, doctor_id: Optional[int] = None) -> list[Appointment]:
    q = select(Appointment).where(Appointment.appointment_date == date.today())
    if doctor_id:
        q = q.where(Appointment.doctor_id == doctor_id)
    return list(db.scalars(q.order_by(Appointment.appointment_time)))


def count_statuses(appts: list[Appointment]) -> dict:
    c = Counter(a.status for a in appts)
    active = [a for a in appts if a.status not in (CANCELLED, NO_SHOW)]
    return {
        "appointments": len(appts),
        "patients": len({a.patient_id for a in active}),
        "scheduled": c[SCHEDULED],
        "waiting": c[WAITING],
        "with_doctor": c[WITH_DOCTOR],
        "completed": c[COMPLETED],
        "pending": c[SCHEDULED] + c[WAITING] + c[WITH_DOCTOR],
        "cancelled": c[CANCELLED] + c[NO_SHOW],
    }


def collection_between(db: Session, start: date, end: date) -> float:
    return float(
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.created_at.between(day_bounds(start)[0], day_bounds(end)[1])
            )
        )
        or 0
    )


def registrations_today(db: Session) -> int:
    start, end = day_bounds(date.today())
    return db.scalar(select(func.count()).where(Patient.created_at.between(start, end))) or 0


def queue_sorted(appts: list[Appointment]) -> list[dict]:
    order = {WITH_DOCTOR: 0, WAITING: 1, SCHEDULED: 2, COMPLETED: 3, NO_SHOW: 4, CANCELLED: 5}
    return [appointment_out(a) for a in sorted(appts, key=lambda a: (order[a.status], a.appointment_time))]


@router.get("/api/dashboard/owner")
def owner_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles(OWNER))):
    today = date.today()
    appts = todays_appointments(db)
    doctors = db.scalars(select(Doctor).join(User).where(User.status == "active", User.role == DOCTOR).order_by(User.name)).all()
    stats = doctor_day_stats(db, today)
    empty = {"patients": 0, "completed": 0, "pending": 0, "waiting": 0, "cancelled": 0}

    # 7-day patient trend
    week_start = today - timedelta(days=6)
    rows = db.execute(
        select(Appointment.appointment_date, func.count(func.distinct(Appointment.patient_id)))
        .where(Appointment.appointment_date.between(week_start, today), Appointment.status.notin_([CANCELLED, NO_SHOW]))
        .group_by(Appointment.appointment_date)
    ).all()
    per_day = {d: n for d, n in rows}
    trend = [
        {"date": (week_start + timedelta(days=i)).isoformat(), "patients": per_day.get(week_start + timedelta(days=i), 0)}
        for i in range(7)
    ]
    activity = db.scalars(
        select(ActivityLog).where(ActivityLog.action != "auth.login").order_by(ActivityLog.timestamp.desc()).limit(12)
    ).all()

    return {
        "counts": count_statuses(appts),
        "collection_today": collection_between(db, today, today),
        "collection_yesterday": collection_between(db, today - timedelta(days=1), today - timedelta(days=1)),
        "new_registrations": registrations_today(db),
        "doctors": [doctor_out(d) | {"today": stats.get(d.id, empty)} for d in doctors],
        "live_queue": [appointment_out(a) for a in appts if a.status in (WAITING, WITH_DOCTOR)],
        "trend": trend,
        "activity": [activity_out(a) for a in activity],
    }


@router.get("/api/dashboard/front-desk")
def front_desk_dashboard(db: Session = Depends(get_db), user: User = Depends(require_roles(OWNER, FRONT_DESK))):
    today = date.today()
    appts = todays_appointments(db)
    start, end = day_bounds(today)
    my_actions = dict(
        db.execute(
            select(ActivityLog.action, func.count())
            .where(ActivityLog.user_id == user.id, ActivityLog.timestamp.between(start, end))
            .group_by(ActivityLog.action)
        ).all()
    )
    return {
        "counts": count_statuses(appts),
        "new_registrations": registrations_today(db),
        "collection_today": collection_between(db, today, today),
        "queue": queue_sorted(appts),
        "my_today": {
            "patients_registered": my_actions.get("patient.registered", 0),
            "appointments_created": my_actions.get("appointment.created", 0),
            "payments_recorded": my_actions.get("payment.recorded", 0),
        },
    }


@router.get("/api/dashboard/doctor")
def doctor_dashboard(db: Session = Depends(get_db), user: User = Depends(require_roles(DOCTOR))):
    doc = doctor_for(db, user)
    today = date.today()
    appts = todays_appointments(db, doc.id)
    follow_ups = db.scalars(
        select(Appointment)
        .where(
            Appointment.doctor_id == doc.id,
            Appointment.appointment_date.between(today + timedelta(days=1), today + timedelta(days=7)),
            Appointment.status == SCHEDULED,
        )
        .order_by(Appointment.appointment_date, Appointment.appointment_time)
        .limit(10)
    ).all()
    return {
        "doctor": doctor_out(doc),
        "counts": count_statuses(appts),
        "queue": queue_sorted(appts),
        "upcoming": [appointment_out(a) for a in follow_ups],
    }


@router.get("/api/analytics")
def analytics(days: int = 30, db: Session = Depends(get_db), _: User = Depends(require_roles(OWNER))):
    days = max(7, min(days, 365))
    today = date.today()
    start = today - timedelta(days=days - 1)

    appts = db.scalars(select(Appointment).where(Appointment.appointment_date.between(start, today))).all()
    active = [a for a in appts if a.status not in (CANCELLED, NO_SHOW)]
    payments = db.scalars(
        select(Payment).where(Payment.created_at.between(day_bounds(start)[0], day_bounds(today)[1]))
    ).all()

    def distinct_patients_since(since: date) -> int:
        return len({a.patient_id for a in active if a.appointment_date >= since})

    def revenue_since(since: date) -> float:
        return sum(p.amount for p in payments if p.created_at.date() >= since)

    # New vs returning: patients seen in range whose first-ever appointment falls inside the range
    seen = {a.patient_id for a in active}
    first_visit = dict(
        db.execute(
            select(Appointment.patient_id, func.min(Appointment.appointment_date))
            .where(Appointment.patient_id.in_(seen))
            .group_by(Appointment.patient_id)
        ).all()
    ) if seen else {}
    new_patients = sum(1 for pid in seen if first_visit.get(pid) and first_visit[pid] >= start)

    # Daily series
    daily_patients: dict[date, set] = defaultdict(set)
    for a in active:
        daily_patients[a.appointment_date].add(a.patient_id)
    daily_revenue: dict[date, float] = defaultdict(float)
    for p in payments:
        daily_revenue[p.created_at.date()] += p.amount
    series = []
    for i in range(days):
        d = start + timedelta(days=i)
        series.append({"date": d.isoformat(), "patients": len(daily_patients.get(d, ())), "revenue": daily_revenue.get(d, 0)})

    # Doctor-wise
    doctors = db.scalars(select(Doctor).join(User).order_by(User.name)).all()
    appt_doctor = {a.id: a.doctor_id for a in appts}
    doc_revenue: dict[int, float] = defaultdict(float)
    for p in payments:
        if p.appointment_id in appt_doctor:
            doc_revenue[appt_doctor[p.appointment_id]] += p.amount
        elif p.appointment_id and p.appointment:
            doc_revenue[p.appointment.doctor_id] += p.amount
    doctor_rows = []
    for d in doctors:
        mine = [a for a in active if a.doctor_id == d.id]
        if not mine and d.user.status != "active":
            continue
        doctor_rows.append({
            "id": d.id,
            "name": d.user.name,
            "specialization": d.specialization,
            "patients": len({a.patient_id for a in mine}),
            "appointments": len(mine),
            "completed": sum(1 for a in mine if a.status == COMPLETED),
            "revenue": doc_revenue.get(d.id, 0),
        })
    doctor_rows.sort(key=lambda r: r["patients"], reverse=True)

    # Peak hours
    hours = Counter(int(a.appointment_time[:2]) for a in active)
    peak_hours = [{"hour": h, "appointments": hours.get(h, 0)} for h in range(8, 21)]

    # Front-desk registrations in range
    reg_rows = db.execute(
        select(User.name, func.count(Patient.id))
        .join(Patient, Patient.created_by == User.id)
        .where(Patient.created_at.between(day_bounds(start)[0], day_bounds(today)[1]))
        .group_by(User.name)
        .order_by(func.count(Patient.id).desc())
    ).all()

    status_counts = Counter(a.status for a in appts)
    pending_consultations = db.scalar(
        select(func.count()).where(Appointment.appointment_date <= today, Appointment.status.in_(OPEN_STATUSES))
    )
    method_totals = Counter()
    for p in payments:
        method_totals[p.payment_method] += p.amount

    return {
        "days": days,
        "patients": {
            "today": distinct_patients_since(today),
            "week": distinct_patients_since(today - timedelta(days=6)),
            "month": distinct_patients_since(today - timedelta(days=29)),
            "in_range": len(seen),
            "new": new_patients,
            "returning": len(seen) - new_patients,
            "avg_daily": round(sum(len(v) for v in daily_patients.values()) / days, 1),
        },
        "appointments": {
            "total": len(appts),
            "completed": status_counts[COMPLETED],
            "cancelled": status_counts[CANCELLED],
            "no_show": status_counts[NO_SHOW],
            "pending": status_counts[SCHEDULED] + status_counts[WAITING] + status_counts[WITH_DOCTOR],
        },
        "revenue": {
            "today": revenue_since(today),
            "week": revenue_since(today - timedelta(days=6)),
            "month": revenue_since(today - timedelta(days=29)),
            "in_range": sum(p.amount for p in payments),
            "by_method": dict(method_totals),
        },
        "series": series,
        "doctors": doctor_rows,
        "peak_hours": peak_hours,
        "registrations_by_staff": [{"name": n, "count": c} for n, c in reg_rows],
        "pending_consultations": pending_consultations,
    }


@router.get("/api/activity")
def activity_feed(
    user_id: Optional[int] = None,
    limit: int = 50,
    before: Optional[int] = None,
    include_logins: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(OWNER)),
):
    q = select(ActivityLog).order_by(ActivityLog.id.desc()).limit(min(limit, 200))
    if user_id:
        q = q.where(ActivityLog.user_id == user_id)
    if before:
        q = q.where(ActivityLog.id < before)
    if not include_logins:
        q = q.where(ActivityLog.action != "auth.login")
    return [activity_out(a) for a in db.scalars(q)]


@router.get("/api/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now()
    items: list[dict] = []

    if user.role == FRONT_DESK:
        appts = todays_appointments(db)
        soon = now + timedelta(minutes=30)
        for a in appts:
            if a.status != SCHEDULED:
                continue
            at = datetime.combine(a.appointment_date, datetime.strptime(a.appointment_time, "%H:%M").time())
            if now <= at <= soon:
                items.append({
                    "level": "info",
                    "message": f"{a.patient.name}'s appointment with {a.doctor.user.name} at {a.appointment_time} is approaching.",
                    "link": "/appointments",
                })
            elif at < now - timedelta(minutes=15):
                items.append({
                    "level": "warning",
                    "message": f"{a.patient.name} ({a.appointment_time}, {a.doctor.user.name}) has not arrived yet.",
                    "link": "/appointments",
                })
        unpaid = sum(1 for a in appts if a.status == COMPLETED and a.fee > 0 and a.payment_status != "paid")
        if unpaid:
            items.append({"level": "warning", "message": f"{unpaid} completed visit(s) today still have pending payment.", "link": "/payments"})

    elif user.role == DOCTOR:
        doc = doctor_for(db, user)
        appts = todays_appointments(db, doc.id)
        waiting = sum(1 for a in appts if a.status == WAITING)
        if waiting:
            items.append({"level": "info", "message": f"{waiting} patient{'s are' if waiting != 1 else ' is'} currently waiting.", "link": "/doctor"})
        follow_ups_today = sum(1 for a in appts if a.visit_type == "follow_up" and a.status in OPEN_STATUSES)
        if follow_ups_today:
            items.append({"level": "info", "message": f"{follow_ups_today} follow-up visit(s) scheduled today.", "link": "/doctor"})

    elif user.role == OWNER:
        appts = todays_appointments(db)
        c = count_statuses(appts)
        if c["pending"]:
            items.append({"level": "info", "message": f"{c['pending']} appointment(s) are pending today.", "link": "/appointments"})
        if c["waiting"] >= 5:
            items.append({"level": "warning", "message": f"{c['waiting']} patients are waiting — queue is building up.", "link": "/owner"})
        stale = db.scalar(
            select(func.count()).where(Appointment.appointment_date < date.today(), Appointment.status.in_(OPEN_STATUSES))
        )
        if stale:
            items.append({"level": "warning", "message": f"{stale} past appointment(s) were never closed.", "link": "/appointments"})
        # Visits with follow-ups due today
        due = db.scalar(select(func.count()).where(Visit.follow_up_date == date.today()))
        if due:
            items.append({"level": "info", "message": f"{due} patient follow-up(s) are due today.", "link": "/appointments"})

    return items
