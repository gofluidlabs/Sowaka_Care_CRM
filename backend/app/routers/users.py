import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DOCTOR, FRONT_DESK, OWNER, ROLES, ActivityLog, Doctor, User
from ..security import generate_temp_password, hash_password, require_roles
from ..services import ROLE_LABELS, day_bounds, log_activity, user_out

router = APIRouter(tags=["users"])
owner_only = require_roles(OWNER)


class UserCreate(BaseModel):
    name: str = Field(min_length=2)
    role: str
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None  # temporary password; generated when omitted
    designation: Optional[str] = None
    specialization: Optional[str] = None
    department: Optional[str] = None
    consultation_fee: Optional[float] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[str] = None
    specialization: Optional[str] = None
    department: Optional[str] = None
    consultation_fee: Optional[float] = None


def suggest_username(db: Session, name: str) -> str:
    parts = re.sub(r"^(dr\.?\s+)", "", name.strip().lower()).split()
    base = ".".join(re.sub(r"[^a-z0-9]", "", p) for p in parts[:2]) or "user"
    candidate, n = base, 1
    while db.scalar(select(User.id).where(User.username == candidate)):
        n += 1
        candidate = f"{base}{n}"
    return candidate


def ensure_doctor_profile(db: Session, user: User, body) -> Doctor:
    doc = user.doctor
    if doc is None:
        doc = Doctor(user=user, consultation_fee=500)
        db.add(doc)
        db.flush()
        doc.code = f"DOC-{doc.id:03d}"
    if body.specialization is not None:
        doc.specialization = body.specialization
    if body.department is not None:
        doc.department = body.department
    if body.consultation_fee is not None:
        doc.consultation_fee = body.consultation_fee
    return doc


@router.get("/api/users")
def list_users(role: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(owner_only)):
    q = select(User).order_by(User.role, User.name)
    if role:
        q = q.where(User.role == role)
    return [user_out(u) for u in db.scalars(q)]


@router.post("/api/users", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), owner: User = Depends(owner_only)):
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role")
    username = (body.username or "").strip().lower() or suggest_username(db, body.name)
    if not re.fullmatch(r"[a-z0-9._-]{3,60}", username):
        raise HTTPException(400, "Username may only contain letters, numbers, dot, dash and underscore")
    if db.scalar(select(User.id).where(func.lower(User.username) == username)):
        raise HTTPException(400, f"Username '{username}' is already taken")
    temp_password = body.password or generate_temp_password()
    if len(temp_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    user = User(
        name=body.name.strip(),
        email=body.email,
        phone=body.phone,
        username=username,
        password_hash=hash_password(temp_password),
        role=body.role,
        designation=body.designation or ROLE_LABELS[body.role],
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    if body.role == DOCTOR:
        ensure_doctor_profile(db, user, body)
    log_activity(
        db, owner, "user.created",
        f"{owner.name} created {ROLE_LABELS[body.role]} account for {user.name}",
        "user", user.id, username,
    )
    db.commit()
    db.refresh(user)
    return {"user": user_out(user), "temporary_password": temp_password}


@router.patch("/api/users/{user_id}")
def update_user(
    user_id: int, body: UserUpdate, db: Session = Depends(get_db), owner: User = Depends(owner_only)
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.id == owner.id and (body.status == "inactive" or (body.role and body.role != OWNER)):
        raise HTTPException(400, "You cannot deactivate or change the role of your own account")

    for field in ("name", "email", "phone", "designation"):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)

    if body.status is not None and body.status != user.status:
        if body.status not in ("active", "inactive"):
            raise HTTPException(400, "Invalid status")
        user.status = body.status
        verb = "activated" if body.status == "active" else "deactivated"
        log_activity(db, owner, f"user.{verb}", f"{owner.name} {verb} {user.name}'s account", "user", user.id, user.username)

    if body.role is not None and body.role != user.role:
        if body.role not in ROLES:
            raise HTTPException(400, "Invalid role")
        log_activity(
            db, owner, "user.role_changed",
            f"{owner.name} changed {user.name}'s role to {ROLE_LABELS[body.role]}",
            "user", user.id, user.username,
        )
        user.role = body.role

    if user.role == DOCTOR:
        ensure_doctor_profile(db, user, body)

    db.commit()
    db.refresh(user)
    return user_out(user)


@router.post("/api/users/{user_id}/reset-password")
def reset_password(user_id: int, db: Session = Depends(get_db), owner: User = Depends(owner_only)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    temp_password = generate_temp_password()
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    log_activity(db, owner, "user.password_reset", f"{owner.name} reset {user.name}'s password", "user", user.id, user.username)
    db.commit()
    return {"user": user_out(user), "temporary_password": temp_password}


STAFF_COUNTED_ACTIONS = {
    "patient.registered": "patients_registered",
    "appointment.created": "appointments_created",
    "payment.recorded": "payments_recorded",
    "appointment.arrived": "arrivals_marked",
}


@router.get("/api/staff")
def staff_overview(db: Session = Depends(get_db), _: User = Depends(owner_only)):
    """Non-doctor staff with today's activity counts."""
    start, end = day_bounds(date.today())
    rows = db.execute(
        select(ActivityLog.user_id, ActivityLog.action, func.count())
        .where(ActivityLog.timestamp.between(start, end))
        .group_by(ActivityLog.user_id, ActivityLog.action)
    ).all()
    counts: dict[int, dict[str, int]] = {}
    for uid, action, n in rows:
        per_user = counts.setdefault(uid, {"total_actions": 0})
        per_user["total_actions"] += n
        if action in STAFF_COUNTED_ACTIONS:
            per_user[STAFF_COUNTED_ACTIONS[action]] = n

    staff = db.scalars(select(User).where(User.role.in_([FRONT_DESK, OWNER])).order_by(User.role.desc(), User.name))
    result = []
    for u in staff:
        data = user_out(u)
        today = {key: 0 for key in STAFF_COUNTED_ACTIONS.values()} | {"total_actions": 0}
        today.update(counts.get(u.id, {}))
        data["today"] = today
        result.append(data)
    return result
