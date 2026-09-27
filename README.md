# Sowaka Care — Hospital Operations CRM (MVP)

A lightweight CRM that brings patients, doctors, the front desk, staff activity and owner analytics into one place.

- **Backend:** FastAPI + SQLAlchemy (SQLite by default, PostgreSQL via `DATABASE_URL`), JWT auth, role-based access
- **Frontend:** React + TypeScript (Vite), no UI framework, responsive

## Quick start

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python seed.py                              # creates sowaka.db with ~60 days of realistic demo data
python -m uvicorn app.main:app --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                                 # http://127.0.0.1:5173  (proxies /api to :8000)
```

**Single-server mode:** run `npm run build` in `frontend/`. The backend then serves the built app at http://127.0.0.1:8000.

### Demo logins

| Role | Username | Password |
|---|---|---|
| Owner / Admin | `owner` | `owner123` |
| Doctor | `amit.gupta` (also `jyoti.sharma`, `rakesh.verma`, `neha.kapoor`) | `doctor123` |
| Front Desk | `priya` (also `rohit`, `meena`) | `front123` |

The login page has one-click demo buttons. Change these passwords before any real use.

## Demo story (Phase 1)

1. **Front desk** (`priya`) searches "Rahul", opens Rahul Sharma (PAT-…), clicks **Book appointment**, picks Dr. Amit and ticks "Patient is here now". Rahul joins Dr. Amit's waiting queue.
2. **Doctor** (`amit.gupta`) sees Rahul as **Next patient**, clicks **Start consultation** (status becomes *With Doctor*), reviews previous visits and allergies, then adds a diagnosis, prescription and follow-up and clicks **Save & complete visit**. The follow-up appointment is booked automatically.
3. **Owner** (`owner`) opens the Command Center and sees Rahul's visit, Dr. Amit's updated counts, today's collection and the activity feed.

## What's included

| Area | Features |
|---|---|
| **Front desk** | Search by name, phone or ID. 3-step registration (basic → visit → payment) with a duplicate-phone warning. New appointment. Today's queue with one-click *Arrived*, *Collect*, *Cancel* and *No-show*. Payments and pending dues. |
| **Doctor** | Today's queue and next-patient card. Consultation screen: diagnosis, vitals, notes, multi-line prescription, follow-up with auto-booking. Previous visits. My patients. Medical history and allergies. |
| **Owner** | Command Center: live counts, collection vs yesterday, doctor workload, 7-day trend, who's in the building, activity feed. Doctors (with drill-down). Staff accountability (today's registrations, bookings, payments, last active). Analytics (7/30/90 days). Full activity log. User & access management: create accounts, auto username and temp password, reset password, activate/deactivate, change role. |
| **All** | Role-based redirect after login, forced password change on first login, patient profile with timeline, in-app notifications. |

### Access control (enforced in the API, not just the UI)

- **Owner:** sees everything.
- **Doctor:** sees only patients whose primary doctor they are or who have had an appointment with them, and only their own appointments. Can edit clinical fields (history, allergies, blood group) but not contact details. Has no access to payments.
- **Front desk:** registration, appointments, payments and basic patient info. Cannot see visits, diagnoses, prescriptions or medical history, and cannot complete consultations.

Every write action is recorded in `activity_logs` (who, what, which patient, when).

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./sowaka.db` | e.g. `postgresql+psycopg://user:pass@localhost:5432/sowaka` |
| `SECRET_KEY` | dev value | **Set in production.** Signs JWTs |
| `TOKEN_HOURS` | `12` | Session length |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list when the frontend is hosted separately (e.g. Vercel) |

Tables are created automatically on startup. `python seed.py` **drops and recreates** all tables, so use it only for demos.

## Project layout

```
backend/
  app/main.py            FastAPI app, routers, serves frontend/dist
  app/models.py          users, doctors, patients, appointments, visits, prescriptions, payments, activity_logs
  app/security.py        bcrypt hashing, JWT, role guards
  app/services.py        access checks, serializers, activity logging
  app/booking.py         shared booking and payment logic
  app/routers/           auth, users/staff, doctors, patients, appointments (+consultation), payments, dashboard/analytics/activity/notifications
  seed.py                demo data
frontend/src/
  pages/                 one file per screen
  components/            Layout, QueueList, PatientSearch, BookingFields, Charts, ActivityFeed, …
```

API docs: http://127.0.0.1:8000/docs

## Not in the MVP (Phase 2+)

Full EMR, lab, pharmacy, inventory, IPD/bed management, insurance, advanced billing, WhatsApp/SMS reminders, patient portal.
