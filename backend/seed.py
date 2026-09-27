"""Reset the database and load realistic demo data for Sowaka Care.

    python seed.py

Demo logins (all created without forced password change):
    owner / owner123          Owner / Admin
    amit.gupta / doctor123    Doctor (also jyoti.sharma, rakesh.verma, neha.kapoor)
    priya / front123          Front Desk (also rohit, meena)
"""
import random
from datetime import date, datetime, time, timedelta

from app.database import Base, SessionLocal, engine
from app.models import (
    CANCELLED, COMPLETED, DOCTOR, FRONT_DESK, NO_SHOW, OWNER, SCHEDULED, WAITING, WITH_DOCTOR,
    ActivityLog, Appointment, Doctor, Patient, Payment, Prescription, User, Visit,
)
from app.security import hash_password

random.seed(7)
TODAY = date.today()
NOW = datetime.now()
# Today's queue is built around a "clinic clock" so a demo seeded after hours still has a live queue.
CLINIC_NOW = NOW if 9 <= NOW.hour < 18 else datetime.combine(TODAY, time(12, 30))
HISTORY_DAYS = 60

DOCTORS = [
    ("Dr. Amit Gupta", "amit.gupta", "General Physician", "General Medicine", 500),
    ("Dr. Jyoti Sharma", "jyoti.sharma", "Gynaecologist", "Obstetrics & Gynaecology", 700),
    ("Dr. Rakesh Verma", "rakesh.verma", "Orthopaedic Surgeon", "Orthopaedics", 800),
    ("Dr. Neha Kapoor", "neha.kapoor", "Paediatrician", "Paediatrics", 600),
]
DESK = [
    ("Priya Singh", "priya", "Front Desk"),
    ("Rohit Kumar", "rohit", "Receptionist"),
    ("Meena Yadav", "meena", "Nurse"),
]
FIRST_M = ["Rahul", "Amit", "Vikas", "Suresh", "Arjun", "Manoj", "Karan", "Deepak", "Sanjay", "Ravi", "Aditya", "Nitin", "Mohit", "Anil", "Harsh", "Gaurav", "Pankaj", "Rohan", "Vivek", "Ashok"]
FIRST_F = ["Neha", "Priya", "Pooja", "Anjali", "Sunita", "Kavita", "Ritu", "Sneha", "Meera", "Swati", "Divya", "Komal", "Nisha", "Rekha", "Shalini", "Aarti", "Jyoti", "Payal", "Simran", "Asha"]
LAST = ["Sharma", "Gupta", "Singh", "Verma", "Yadav", "Kumar", "Mishra", "Jain", "Agarwal", "Chauhan", "Tiwari", "Pandey", "Saxena", "Rastogi", "Bansal", "Malhotra", "Srivastava", "Dubey"]
AREAS = ["Gomti Nagar", "Indira Nagar", "Aliganj", "Hazratganj", "Alambagh", "Mahanagar", "Aashiana", "Vikas Nagar", "Rajajipuram", "Jankipuram"]

CLINICAL = {
    "General Medicine": [
        ("Viral fever", "Fever for 3 days, body ache. No rash.", [("Paracetamol 650mg", "1 tab TDS", "5 days", "After food"), ("ORS", "1 sachet in 1L water", "3 days", "Sip through the day")]),
        ("Type 2 diabetes — review", "Sugar levels improving. Continue diet control.", [("Metformin 500mg", "1 tab BD", "30 days", "After meals")]),
        ("Hypertension", "BP 150/95. Advised salt restriction and walks.", [("Amlodipine 5mg", "1 tab OD", "30 days", "Morning")]),
        ("Acute gastritis", "Epigastric pain after meals.", [("Pantoprazole 40mg", "1 tab OD", "14 days", "Before breakfast"), ("Antacid gel", "10ml TDS", "7 days", "After food")]),
        ("Upper respiratory infection", "Sore throat, mild cough.", [("Azithromycin 500mg", "1 tab OD", "3 days", "After food"), ("Cetirizine 10mg", "1 tab HS", "5 days", "At bedtime")]),
    ],
    "Obstetrics & Gynaecology": [
        ("Antenatal check-up (2nd trimester)", "Foetal heart sounds normal. Weight gain adequate.", [("Folic acid 5mg", "1 tab OD", "30 days", ""), ("Calcium + Vit D3", "1 tab BD", "30 days", "After meals")]),
        ("PCOS", "Irregular cycles. USG advised.", [("Metformin 500mg", "1 tab BD", "60 days", "After meals")]),
        ("Iron deficiency anaemia", "Hb 9.2. Pallor present.", [("Ferrous ascorbate", "1 tab OD", "90 days", "After lunch")]),
    ],
    "Orthopaedics": [
        ("Lumbar spondylosis", "Low back pain radiating to left leg. SLR negative.", [("Aceclofenac + Paracetamol", "1 tab BD", "5 days", "After food"), ("Thiocolchicoside 4mg", "1 tab BD", "5 days", "")]),
        ("Knee osteoarthritis", "Bilateral knee pain, crepitus present.", [("Glucosamine", "1 tab OD", "60 days", ""), ("Diclofenac gel", "Local application", "14 days", "Twice a day")]),
        ("Ankle sprain", "Grade 1 sprain, RICE advised.", [("Ibuprofen 400mg", "1 tab TDS", "5 days", "After food")]),
    ],
    "Paediatrics": [
        ("Acute gastroenteritis", "Loose stools x 2 days, mild dehydration.", [("ORS", "As needed", "3 days", "After every loose stool"), ("Zinc syrup", "5ml OD", "14 days", "")]),
        ("Routine vaccination", "Vaccination as per schedule. Growth normal.", []),
        ("Allergic rhinitis", "Sneezing, running nose in mornings.", [("Levocetirizine syrup", "2.5ml HS", "7 days", "At bedtime")]),
    ],
}
REASONS = ["Fever", "Follow-up", "Routine check-up", "Pain", "Consultation", "Report review", "Cough & cold", "BP check"]


def rand_phone() -> str:
    return f"9{random.randint(100000000, 999999999)}"


def main():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    logs: list[ActivityLog] = []

    def log(user, action, desc, patient=None, at=None):
        logs.append(ActivityLog(
            user_id=user.id, action=action, description=desc,
            entity_type="patient" if patient else None,
            entity_id=patient.id if patient else None,
            entity_label=patient.patient_code if patient else None,
            timestamp=at or NOW,
        ))

    # ------------------------------------------------------------ users
    owner = User(name="Anand Mehra", email="owner@sowakacare.in", phone="9810000001", username="owner",
                 password_hash=hash_password("owner123"), role=OWNER, designation="Owner / Admin",
                 must_change_password=False, created_at=NOW - timedelta(days=HISTORY_DAYS + 5))
    db.add(owner)
    db.flush()

    doctors: list[Doctor] = []
    for i, (name, username, spec, dept, fee) in enumerate(DOCTORS, start=1):
        u = User(name=name, email=f"{username}@sowakacare.in", phone=rand_phone(), username=username,
                 password_hash=hash_password("doctor123"), role=DOCTOR, designation="Doctor",
                 must_change_password=False, created_at=NOW - timedelta(days=HISTORY_DAYS + 3))
        db.add(u)
        db.flush()
        d = Doctor(user=u, code=f"DOC-{i:03d}", specialization=spec, department=dept, consultation_fee=fee)
        db.add(d)
        doctors.append(d)
        log(owner, "user.created", f"{owner.name} created Doctor account for {name}", at=u.created_at)

    desk: list[User] = []
    for name, username, designation in DESK:
        u = User(name=name, email=f"{username}@sowakacare.in", phone=rand_phone(), username=username,
                 password_hash=hash_password("front123"), role=FRONT_DESK, designation=designation,
                 must_change_password=False, created_at=NOW - timedelta(days=HISTORY_DAYS + 3))
        db.add(u)
        desk.append(u)
    db.flush()
    for u in desk:
        log(owner, "user.created", f"{owner.name} created Front Desk account for {u.name}", at=u.created_at)

    # ------------------------------------------------------------ patients
    patients: list[Patient] = []

    def make_patient(name, gender, age, registered_at, clerk, doctor=None, phone=None):
        p = Patient(
            name=name, phone=phone or rand_phone(), gender=gender,
            dob=TODAY.replace(year=TODAY.year - age) - timedelta(days=random.randint(0, 300)),
            address=f"{random.randint(1, 450)}, {random.choice(AREAS)}, Lucknow",
            emergency_contact_name=f"{random.choice(FIRST_M + FIRST_F)} {name.split()[-1]}",
            emergency_contact_phone=rand_phone(),
            blood_group=random.choice(["A+", "B+", "O+", "AB+", "A-", "O-", None]),
            primary_doctor_id=doctor.id if doctor else None,
            created_by=clerk.id, created_at=registered_at,
        )
        db.add(p)
        db.flush()
        p.patient_code = f"PAT-{registered_at.year}-{p.id:05d}"
        log(clerk, "patient.registered", f"{clerk.name} registered a new patient — {name}", p, registered_at)
        patients.append(p)
        return p

    used_names = set()
    for _ in range(150):
        gender = random.choice(["Male", "Female"])
        while True:
            name = f"{random.choice(FIRST_M if gender == 'Male' else FIRST_F)} {random.choice(LAST)}"
            if name not in used_names and name != "Rahul Sharma":
                used_names.add(name)
                break
        reg_day = TODAY - timedelta(days=random.randint(1, HISTORY_DAYS))
        reg_at = datetime.combine(reg_day, time(random.randint(9, 17), random.choice([0, 10, 20, 30, 40, 50])))
        make_patient(name, gender, random.randint(2, 78), reg_at, random.choice(desk))
    patients.sort(key=lambda p: p.created_at)

    # ------------------------------------------------------------ appointments
    def slot_times(day: date, n: int) -> list[str]:
        slots = [f"{h:02d}:{m:02d}" for h in range(9, 19) for m in (0, 30)]
        return sorted(random.sample(slots, min(n, len(slots))))

    def add_visit(appt: Appointment, clerk: User, at: datetime, complete: bool):
        dept = appt.doctor.department
        diagnosis, notes, meds = random.choice(CLINICAL[dept])
        follow = appt.appointment_date + timedelta(days=random.choice([7, 14, 30])) if random.random() < 0.4 else None
        v = Visit(patient_id=appt.patient_id, doctor_id=appt.doctor_id, appointment=appt, diagnosis=diagnosis,
                  notes=notes, vitals=f"BP {random.randint(110, 150)}/{random.randint(70, 95)}, Pulse {random.randint(68, 96)}",
                  follow_up_date=follow, created_at=at, updated_at=at)
        v.prescriptions = [Prescription(medicine=m, dosage=d, duration=du, instructions=ins) for m, d, du, ins in meds]
        db.add(v)
        doc_user = appt.doctor.user
        if meds:
            log(doc_user, "prescription.added", f"{doc_user.name} added a prescription for {appt.patient.name}", appt.patient, at + timedelta(minutes=8))
        if complete:
            log(doc_user, "appointment.completed", f"{doc_user.name} completed consultation for {appt.patient.name}", appt.patient, at + timedelta(minutes=10))

    def add_payment(appt: Appointment, clerk: User, at: datetime, partial=False):
        amount = appt.fee if not partial else round(appt.fee / 2, -1)
        method = random.choices(["upi", "cash", "card"], weights=[5, 4, 1])[0]
        db.add(Payment(patient_id=appt.patient_id, appointment=appt, amount=amount, payment_method=method,
                       created_by=clerk.id, created_at=at))
        log(clerk, "payment.recorded", f"{clerk.name} recorded ₹{amount:,.0f} ({method.upper()}) from {appt.patient.name}", appt.patient, at)

    doctor_weights = [5, 3, 2, 3]
    for offset in range(HISTORY_DAYS, -1, -1):
        day = TODAY - timedelta(days=offset)
        is_today = offset == 0
        weekday_boost = 1.2 if day.weekday() == 0 else 0.6 if day.weekday() == 6 else 1
        n = int(random.randint(14, 26) * weekday_boost) if not is_today else 26
        eligible = [p for p in patients if p.created_at.date() <= day]
        if not eligible:
            continue
        chosen = random.sample(eligible, min(n, len(eligible)))
        for patient, t in zip(chosen, slot_times(day, len(chosen))):
            doctor = random.choices(doctors, weights=doctor_weights)[0]
            if patient.primary_doctor_id and random.random() < 0.7:
                doctor = next(d for d in doctors if d.id == patient.primary_doctor_id)
            patient.primary_doctor_id = patient.primary_doctor_id or doctor.id
            clerk = random.choice(desk)
            at = datetime.combine(day, datetime.strptime(t, "%H:%M").time())
            booked_at = at - timedelta(hours=random.randint(1, 48)) if random.random() < 0.6 else at - timedelta(minutes=20)
            booked_at = max(booked_at, patient.created_at)
            if booked_at > NOW:
                booked_at = NOW - timedelta(minutes=random.randint(5, 120))
            appt = Appointment(
                patient=patient, doctor=doctor, appointment_date=day, appointment_time=t,
                department=doctor.department,
                visit_type=random.choices(["consultation", "follow_up", "check_up"], weights=[6, 3, 1])[0],
                reason=random.choice(REASONS), fee=doctor.consultation_fee, created_by=clerk.id, created_at=booked_at,
            )
            db.add(appt)
            db.flush()
            log(clerk, "appointment.created", f"{clerk.name} booked {patient.name} with {doctor.user.name} ({day.strftime('%d %b')} {t})", patient, booked_at)

            if not is_today:
                roll = random.random()
                if roll < 0.06:
                    appt.status = CANCELLED
                    log(clerk, "appointment.cancelled", f"{clerk.name} cancelled appointment for {patient.name}", patient, booked_at + timedelta(hours=1))
                elif roll < 0.10:
                    appt.status = NO_SHOW
                else:
                    appt.status = COMPLETED
                    appt.arrived_at = at - timedelta(minutes=random.randint(5, 25))
                    appt.completed_at = at + timedelta(minutes=random.randint(10, 25))
                    log(clerk, "appointment.arrived", f"{clerk.name} marked arrived {patient.name}", patient, appt.arrived_at)
                    add_visit(appt, clerk, at + timedelta(minutes=2), complete=True)
                    if random.random() < 0.94:
                        add_payment(appt, clerk, appt.arrived_at, partial=random.random() < 0.05)
            else:
                minutes_ago = (CLINIC_NOW - at).total_seconds() / 60
                if minutes_ago > 40:
                    appt.status = random.choices([COMPLETED, NO_SHOW], weights=[12, 1])[0]
                elif minutes_ago > 15:
                    appt.status = WITH_DOCTOR
                elif minutes_ago > -20:
                    appt.status = WAITING
                else:
                    appt.status = SCHEDULED
                if appt.status in (COMPLETED, WITH_DOCTOR, WAITING):
                    appt.arrived_at = min(at - timedelta(minutes=10), NOW - timedelta(minutes=2))
                    log(clerk, "appointment.arrived", f"{clerk.name} marked arrived {patient.name}", patient, appt.arrived_at)
                    add_payment(appt, clerk, appt.arrived_at)
                if appt.status == COMPLETED:
                    appt.completed_at = min(at + timedelta(minutes=15), NOW)
                    add_visit(appt, clerk, min(at + timedelta(minutes=2), NOW), complete=True)

    # ------------------------------------------------------------ the demo patient: Rahul Sharma
    amit = doctors[0]
    priya = desk[0]
    rahul_reg = datetime.combine(TODAY - timedelta(days=17), time(10, 5))
    rahul = make_patient("Rahul Sharma", "Male", 34, rahul_reg, priya, amit, phone="9876543210")
    rahul.medical_history = "Mild hypertension (2024). Non-smoker."
    rahul.allergies = "Penicillin"
    for days_ago, vtype, reason, diag, notes, meds in [
        (17, "consultation", "Headache & dizziness", "Hypertension — stage 1", "BP 148/94. Lifestyle changes advised.",
         [("Amlodipine 5mg", "1 tab OD", "30 days", "Morning")]),
        (7, "follow_up", "BP review", "Hypertension — controlled", "BP 132/86. Continue medication.",
         [("Amlodipine 5mg", "1 tab OD", "30 days", "Morning")]),
    ]:
        day = TODAY - timedelta(days=days_ago)
        at = datetime.combine(day, time(10, 30))
        appt = Appointment(patient=rahul, doctor=amit, appointment_date=day, appointment_time="10:30",
                           department=amit.department, visit_type=vtype, reason=reason, fee=amit.consultation_fee,
                           status=COMPLETED, created_by=priya.id, created_at=at - timedelta(minutes=25),
                           arrived_at=at - timedelta(minutes=10), completed_at=at + timedelta(minutes=15))
        db.add(appt)
        db.flush()
        log(priya, "appointment.created", f"{priya.name} booked Rahul Sharma with {amit.user.name} ({day.strftime('%d %b')} 10:30)", rahul, appt.created_at)
        v = Visit(patient_id=rahul.id, doctor_id=amit.id, appointment=appt, diagnosis=diag, notes=notes,
                  vitals="BP 148/94, Pulse 82" if days_ago == 17 else "BP 132/86, Pulse 76",
                  follow_up_date=day + timedelta(days=10) if days_ago == 17 else None, created_at=at, updated_at=at)
        v.prescriptions = [Prescription(medicine=m, dosage=d, duration=du, instructions=i) for m, d, du, i in meds]
        db.add(v)
        log(amit.user, "appointment.completed", f"{amit.user.name} completed consultation for Rahul Sharma", rahul, at + timedelta(minutes=15))
        add_payment(appt, priya, appt.arrived_at)

    # ------------------------------------------------------------ last login times
    for u in [owner, *[d.user for d in doctors], *desk]:
        u.last_login = NOW - timedelta(minutes=random.randint(10, 300))
        u.last_active = u.last_login + timedelta(minutes=random.randint(0, 9))
        if u.last_active > NOW:
            u.last_active = NOW

    db.add_all(logs)
    db.commit()
    print(f"Seeded: {len(doctors)} doctors, {len(desk)} front-desk staff, {len(patients)} patients, "
          f"{db.query(Appointment).count()} appointments, {db.query(Visit).count()} visits, "
          f"{db.query(Payment).count()} payments, {len(logs)} activity entries.")
    db.close()


if __name__ == "__main__":
    main()
