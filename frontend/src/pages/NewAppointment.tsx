import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import {
  PaymentFields, VisitFields, emptyPay, emptyVisit, paymentPayload, useDoctors, visitPayload,
  type PayForm, type VisitForm,
} from '../components/BookingFields'
import PatientSearch from '../components/PatientSearch'
import { Avatar, ErrorBox, useToast } from '../components/ui'
import type { Appointment, Patient } from '../types'
import { fmt12, fmtDate } from '../utils'

export default function NewAppointment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const doctors = useDoctors()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visit, setVisit] = useState<VisitForm>(emptyVisit)
  const [pay, setPay] = useState<PayForm>(emptyPay)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Appointment | null>(null)

  // Deep link from a patient profile: /appointments/new?patient=12
  useEffect(() => {
    const id = params.get('patient')
    if (id) api.get<{ patient: Patient }>(`/api/patients/${id}`).then((r) => setPatient(r.patient)).catch(() => {})
  }, [params])

  // Default to the patient's usual doctor
  useEffect(() => {
    if (patient?.primary_doctor_id && doctors.some((d) => d.id === patient.primary_doctor_id)) {
      setVisit((v) => (v.doctor_id ? v : { ...v, doctor_id: patient.primary_doctor_id }))
    }
  }, [patient, doctors])

  useEffect(() => {
    const d = doctors.find((x) => x.id === visit.doctor_id)
    if (d) setPay((p) => ({ ...p, fee: String(d.consultation_fee), amount: String(d.consultation_fee) }))
  }, [visit.doctor_id, doctors])

  const submit = async () => {
    if (!patient) return setError('Select a patient first')
    if (!visit.doctor_id) return setError('Choose a doctor')
    setBusy(true)
    setError(null)
    try {
      const appt = await api.post<Appointment>('/api/appointments', {
        patient_id: patient.id,
        ...visitPayload(visit, pay),
        payment: paymentPayload(pay),
      })
      toast(`Appointment booked for ${patient.name}`)
      setDone(appt)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card card-body" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: 32 }}>
        <CheckCircle2 size={48} color="var(--green)" style={{ margin: '0 auto 12px' }} />
        <h1>{done.status === 'waiting' ? 'Added to queue' : 'Appointment booked'}</h1>
        <p className="muted">
          <strong style={{ color: 'var(--ink)' }}>{done.patient_name}</strong> with <strong style={{ color: 'var(--ink)' }}>{done.doctor_name}</strong>
          <br />
          {fmtDate(done.appointment_date, { weekday: 'long', day: 'numeric', month: 'long' })} at {fmt12(done.appointment_time)}
        </p>
        <div className="row mt" style={{ justifyContent: 'center' }}>
          <Link to="/appointments" className="btn">Today's queue</Link>
          <button className="btn primary" onClick={() => { setDone(null); setPatient(null); setVisit(emptyVisit()); navigate('/appointments/new') }}>
            Book another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>New appointment</h1>
          <p>Find the patient, pick a doctor and time.</p>
        </div>
      </div>
      <div className="stack">
        <ErrorBox message={error} />
        <div className="card card-body">
          <div className="label" style={{ marginBottom: 8 }}>1 · Patient</div>
          {patient ? (
            <div className="row" style={{ gap: 12 }}>
              <Avatar name={patient.name} />
              <div style={{ flex: 1 }}>
                <div className="strong">{patient.name}</div>
                <div className="small muted">
                  {patient.patient_code} · {patient.phone}{patient.age !== null && ` · ${patient.age} yrs`}
                  {patient.primary_doctor_name && ` · Usually sees ${patient.primary_doctor_name}`}
                </div>
              </div>
              <button className="btn sm ghost" onClick={() => setPatient(null)}><X /> Change</button>
            </div>
          ) : (
            <PatientSearch
              autoFocus
              onSelect={setPatient}
              onCreate={(q) => navigate(`/register?${/^\d+$/.test(q) ? 'phone' : 'name'}=${encodeURIComponent(q)}`)}
            />
          )}
        </div>
        <div className="card card-body">
          <div className="label" style={{ marginBottom: 12 }}>2 · Visit</div>
          <VisitFields value={visit} onChange={setVisit} doctors={doctors} />
        </div>
        <div className="card card-body">
          <div className="label" style={{ marginBottom: 12 }}>3 · Payment</div>
          <PaymentFields value={pay} onChange={setPay} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary lg" onClick={submit} disabled={busy || !patient}>
            {busy ? 'Booking…' : 'Book appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
