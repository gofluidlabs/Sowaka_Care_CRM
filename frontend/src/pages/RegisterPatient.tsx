import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api'
import {
  PaymentFields, VisitFields, emptyPay, emptyVisit, paymentPayload, useDoctors, visitPayload,
  type PayForm, type VisitForm,
} from '../components/BookingFields'
import { ErrorBox, useToast } from '../components/ui'
import type { Appointment, Patient } from '../types'
import { fmt12, fmtDate } from '../utils'

const GENDERS = ['Male', 'Female', 'Other']

interface BasicForm {
  name: string
  phone: string
  age: string
  dob: string
  gender: string
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

export default function RegisterPatient() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const doctors = useDoctors()
  const [step, setStep] = useState(1)
  const [basic, setBasic] = useState<BasicForm>({
    name: params.get('name') ?? '', phone: params.get('phone') ?? '', age: '', dob: '', gender: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })
  const [bookNow, setBookNow] = useState(true)
  const [visit, setVisit] = useState<VisitForm>(emptyVisit)
  const [pay, setPay] = useState<PayForm>(emptyPay)
  const [dupes, setDupes] = useState<Patient[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ patient: Patient; appointment: Appointment | null } | null>(null)

  const set = (patch: Partial<BasicForm>) => setBasic((b) => ({ ...b, ...patch }))

  // Warn about existing patients with the same phone number
  useEffect(() => {
    const digits = basic.phone.replace(/\D/g, '')
    if (digits.length < 10) return setDupes([])
    const id = setTimeout(() => {
      api.get<{ items: Patient[] }>(`/api/patients${qs({ q: digits.slice(-10), limit: 5 })}`).then((r) => setDupes(r.items)).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [basic.phone])

  // Prefill fee from the selected doctor
  useEffect(() => {
    const d = doctors.find((x) => x.id === visit.doctor_id)
    if (d) setPay((p) => ({ ...p, fee: String(d.consultation_fee), amount: String(d.consultation_fee) }))
  }, [visit.doctor_id, doctors])

  const step1Valid = basic.name.trim().length >= 2 && basic.phone.replace(/\D/g, '').length >= 10 && (basic.age || basic.dob) && basic.gender
  const step2Valid = !bookNow || (visit.doctor_id && visit.appointment_date && visit.appointment_time)

  const next = () => {
    setError(null)
    if (step === 1 && !step1Valid) return setError('Please fill name, a 10-digit mobile number, age (or date of birth) and gender.')
    if (step === 2 && !step2Valid) return setError('Please choose a doctor, date and time — or untick "Book a visit now".')
    if (step === 2 && !bookNow) return submit()
    setStep((s) => s + 1)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<{ patient: Patient; appointment: Appointment | null }>('/api/patients', {
        name: basic.name.trim(),
        phone: basic.phone,
        age: basic.dob ? null : Number(basic.age),
        dob: basic.dob || null,
        gender: basic.gender,
        address: basic.address || null,
        emergency_contact_name: basic.emergency_contact_name || null,
        emergency_contact_phone: basic.emergency_contact_phone || null,
        appointment: bookNow ? visitPayload(visit, pay) : null,
        payment: bookNow ? paymentPayload(pay) : null,
      })
      toast(`${res.patient.name} registered — ${res.patient.patient_code}`)
      setDone(res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const a = done.appointment
    return (
      <div className="card card-body" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center', padding: 32 }}>
        <CheckCircle2 size={48} color="var(--green)" style={{ margin: '0 auto 12px' }} />
        <h1>Patient registered</h1>
        <div className="secret" style={{ margin: '16px auto', display: 'inline-block' }}>{done.patient.patient_code}</div>
        <p className="muted" style={{ margin: 0 }}>
          {done.patient.name} · {done.patient.phone}
          {a && (
            <>
              <br />
              {a.status === 'waiting' ? 'Added to the waiting queue for ' : 'Appointment booked with '}
              <strong>{a.doctor_name}</strong> — {fmtDate(a.appointment_date, { day: 'numeric', month: 'short' })} at {fmt12(a.appointment_time)}
            </>
          )}
        </p>
        <div className="row mt" style={{ justifyContent: 'center' }}>
          <Link to={`/patients/${done.patient.id}`} className="btn">View profile</Link>
          <button className="btn primary" onClick={() => navigate(0)}>Register another</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Register patient</h1>
          <p>Patient ID is generated automatically.</p>
        </div>
      </div>

      <div className="steps">
        {['Basic information', 'Visit', 'Payment'].map((t, i) => (
          <div key={t} className={`step${step === i + 1 ? ' on' : ''}${step > i + 1 ? ' done' : ''}`}>
            <span className="n">{step > i + 1 ? <Check size={14} /> : i + 1}</span>
            <span className="t">{t}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body stack">
          <ErrorBox message={error} />

          {step === 1 && (
            <>
              <div className="form-grid">
                <div className="field span-2">
                  <label className="req">Full name</label>
                  <input className="input" value={basic.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
                </div>
                <div className="field">
                  <label className="req">Mobile number</label>
                  <input className="input" inputMode="tel" value={basic.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="10-digit mobile" />
                </div>
                <div className="field">
                  <label className="req">Gender</label>
                  <div className="seg" style={{ alignSelf: 'flex-start' }}>
                    {GENDERS.map((g) => (
                      <button type="button" key={g} className={basic.gender === g ? 'on' : ''} onClick={() => set({ gender: g })}>{g}</button>
                    ))}
                  </div>
                </div>
                {dupes.length > 0 && (
                  <div className="alert warn span-2" style={{ flexDirection: 'column' }}>
                    <strong>This number is already registered:</strong>
                    {dupes.map((p) => (
                      <div key={p.id}>
                        <Link to={`/patients/${p.id}`}>{p.name}</Link> — {p.patient_code}{p.age !== null && `, ${p.age} yrs`}.{' '}
                        <Link to={`/appointments/new?patient=${p.id}`}>Book appointment instead →</Link>
                      </div>
                    ))}
                  </div>
                )}
                <div className="field">
                  <label className="req">Age (years)</label>
                  <input className="input" type="number" min={0} max={130} value={basic.age} onChange={(e) => set({ age: e.target.value, dob: '' })} />
                </div>
                <div className="field">
                  <label>or Date of birth</label>
                  <input className="input" type="date" value={basic.dob} onChange={(e) => set({ dob: e.target.value, age: '' })} />
                </div>
                <div className="field span-2">
                  <label>Address</label>
                  <input className="input" value={basic.address} onChange={(e) => set({ address: e.target.value })} />
                </div>
                <div className="field">
                  <label>Emergency contact name</label>
                  <input className="input" value={basic.emergency_contact_name} onChange={(e) => set({ emergency_contact_name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Emergency contact phone</label>
                  <input className="input" inputMode="tel" value={basic.emergency_contact_phone} onChange={(e) => set({ emergency_contact_phone: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="check strong">
                <input type="checkbox" checked={bookNow} onChange={(e) => setBookNow(e.target.checked)} />
                Book a visit now
              </label>
              {bookNow && <VisitFields value={visit} onChange={setVisit} doctors={doctors} />}
            </>
          )}

          {step === 3 && <PaymentFields value={pay} onChange={setPay} />}
        </div>
        <div className="modal-foot">
          {step > 1 && (
            <button className="btn" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              <ArrowLeft /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="btn primary" onClick={next} disabled={busy}>
              {step === 2 && !bookNow ? (busy ? 'Registering…' : 'Register patient') : <>Next <ArrowRight /></>}
            </button>
          ) : (
            <button className="btn primary lg" onClick={submit} disabled={busy}>{busy ? 'Registering…' : 'Register patient'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
