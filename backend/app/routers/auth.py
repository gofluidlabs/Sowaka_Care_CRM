from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import create_token, get_current_user, hash_password, verify_password
from ..services import log_activity, user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.username) == body.username.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    if user.status != "active":
        raise HTTPException(403, "This account has been deactivated. Contact the administrator.")
    user.last_login = user.last_active = datetime.now()
    log_activity(db, user, "auth.login", f"{user.name} logged in", "user", user.id)
    db.commit()
    return {"token": create_token(user), "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(400, "New password must be different from the current one")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    log_activity(db, user, "auth.password_changed", f"{user.name} changed their password", "user", user.id)
    db.commit()
    return user_out(user)
