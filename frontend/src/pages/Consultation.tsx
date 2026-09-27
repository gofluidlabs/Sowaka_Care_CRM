import { ArrowLeft, CheckCircle2, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import VisitCard from '../components/VisitCard'
import { Avatar, Empty, ErrorBox, Loading, StatusBadge, useToast } from '../components/ui'
import type { Appointment, Patient, PrescriptionItem, Visit } from '../types'
import { addDays, fmt12, fmtDate, todayISO, useFetch, visitTypeLabel } from '../utils'

interface ConsultData {
  appointment: Appointment
  patient: Patient
  visit: Visit | null
  previous_visits: Visit[]
}

const blankRx = (): PrescriptionItem => ({ medicine: '', dosage: '', duration: '', instructions: '' })
const QUICK_FOLLOW_UPS = [3, 7, 14, 30]

export default function Consultation() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, error, reload } = useFetch<ConsultData>(`/api/appointments/${id}/consultation`)
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [vitals, setVitals] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [bookFollowUp, setBookFollowUp] = useState(true)
  const [rx, setRx] = useState<PrescriptionItem[]>([blankRx()])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!data?.visit) return
    const v = data.visit
    setDiagnosis(v.diagnosis ?? '')
    setNotes(v.notes ?? '')
    setVitals(v.vitals ?? '')
    setFollowUp(v.follow_up_date ?? '')
    setRx(v.prescriptions.length ? v.prescriptions.map((p) => ({ ...p })) : [blankRx()])
  }, [data?.visit])

  // Opening a waiting patient's consultation moves them to "With Doctor" so the desk and owner see it live
  const status = data?.appointment.status
  useEffect(() => {
    if (user?.role !== 'doctor' || (status !== 'waiting' && status !== 'scheduled')) return
    api.patch(`/api/appointments/${id}/status`, { status: 'with_doctor' }).then(reload).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, id, user?.role])

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const { appointment: a, patient: p } = data
  const readOnly = user?.role !== 'doctor' || a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show'

  const updateRx = (i: number, patch: Partial<PrescriptionItem>) => setRx(rx.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const save = async (complete: boolean) => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await api.post<{ follow_up: Appointment | null }>(`/api/appointments/${a.id}/consultation`, {
        diagnosis: diagnosis || null,
        notes: notes || null,
        vitals: vitals || null,
        follow_up_date: followUp || null,
        book_follow_up: bookFollowUp,
        prescriptions: rx.filter((r) => r.medicine.trim()).map((r) => ({
          medicine: r.medicine.trim(), dosage: r.dosage || null, duration: r.duration || null, instructions: r.instructions || null,
        })),
        complete,
      })
      if (complete) {
        toast(res.follow_up ? `Consultation completed · follow-up booked for ${fmtDate(res.follow_up.appointment_date, { day: 'numeric', month: 'short' })}` : 'Consultation completed')
        navigate('/doctor')
      } else {
        toast('Consultation saved')
        reload()
      }
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ArrowLeft /> Back</button>

      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="profile-head">
          <Avatar name={p.name} lg />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="code">{p.patient_code}</div>
            <h1>{p.name}</h1>
            <div className="facts">
              <span>{p.age !== null ? `${p.age} yrs` : '—'}{p.gender && ` · ${p.gender}`}</span>
              {p.blood_group && <span>Blood group {p.blood_group}</span>}
              <span>{fmt12(a.appointment_time)} · {visitTypeLabel(a.visit_type)}</span>
              {a.reason && <span>Reason: {a.reason}</span>}
            </div>
            {p.allergies && <div className="chip warn" style={{ marginTop: 8 }}><ShieldAlert size={13} /> Allergies: {p.allergies}</div>}
          </div>
          <div className="actions">
            <StatusBadge status={a.status} />
            <Link to={`/patients/${p.id}`} className="btn">Full profile</Link>
          </div>
        </div>
      </div>

      <div className="grid g-main">
        <div className="card">
          <div className="card-head">
            <h2>{readOnly ? 'Consultation record' : 'Current consultation'}</h2>
            <span className="sub">{fmtDate(a.appointment_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <div className="card-body stack">
            <ErrorBox message={saveError} />
            {readOnly && !data.visit && <Empty>No consultation notes were recorded for this appointment.</Empty>}
            {(!readOnly || data.visit) && (
              <>
                <div className="form-grid">
                  <div className="field span-2">
                    <label>Diagnosis</label>
                    <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} disabled={readOnly} autoFocus={!readOnly} placeholder="e.g. Viral fever" />
                  </div>
                  <div className="field span-2">
                    <label>Vitals</label>
                    <input className="input" value={vitals} onChange={(e) => setVitals(e.target.value)} disabled={readOnly} placeholder="BP 120/80, Pulse 76, Temp 98.6°F, SpO₂ 98%" />
                  </div>
                  <div className="field span-2">
                    <label>Notes</label>
                    <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} placeholder="Symptoms, examination findings, advice…" />
                  </div>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Prescription</div>
                  {rx.map((r, i) => (
                    <div className="rx-row" key={i}>
                      <input className="input" placeholder="Medicine" value={r.medicine} onChange={(e) => updateRx(i, { medicine: e.target.value })} disabled={readOnly} />
                      <input className="input" placeholder="Dosage (1-0-1)" value={r.dosage ?? ''} onChange={(e) => updateRx(i, { dosage: e.target.value })} disabled={readOnly} />
                      <input className="input" placeholder="Duration" value={r.duration ?? ''} onChange={(e) => updateRx(i, { duration: e.target.value })} disabled={readOnly} />
                      <input className="input" placeholder="Instructions" value={r.instructions ?? ''} onChange={(e) => updateRx(i, { instructions: e.target.value })} disabled={readOnly} />
                      {!readOnly && (
                        <button className="btn icon ghost" onClick={() => setRx(rx.length > 1 ? rx.filter((_, j) => j !== i) : [blankRx()])} aria-label="Remove medicine">
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && <button className="btn sm" onClick={() => setRx([...rx, blankRx()])}><Plus /> Add medicine</button>}
                </div>

                <div className="field">
                  <label>Follow-up date</label>
                  <div className="row wrap">
                    <input className="input" type="date" value={followUp} min={addDays(todayISO(), 1)} onChange={(e) => setFollowUp(e.target.value)} disabled={readOnly} style={{ width: 180 }} />
                    {!readOnly && QUICK_FOLLOW_UPS.map((d) => (
                      <button key={d} className="btn sm" type="button" onClick={() => setFollowUp(addDays(todayISO(), d))}>
                        {d < 7 ? `${d} days` : d === 7 ? '1 week' : d === 14 ? '2 weeks' : '1 month'}
                      </button>
                    ))}
                    {!readOnly && followUp && <button className="link-btn small" onClick={() => setFollowUp('')}>Clear</button>}
                  </div>
                  {!readOnly && followUp && (
                    <label className="check small" style={{ marginTop: 4 }}>
                      <input type="checkbox" checked={bookFollowUp} onChange={(e) => setBookFollowUp(e.target.checked)} />
                      Book the follow-up appointment automatically (10:00 AM)
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
          {!readOnly && (
            <div className="modal-foot">
              <button className="btn" onClick={() => save(false)} disabled={saving}><Save /> Save draft</button>
              <button className="btn primary lg" onClick={() => save(true)} disabled={saving}>
                <CheckCircle2 /> {saving ? 'Saving…' : 'Save & complete visit'}
              </button>
            </div>
          )}
        </div>

        <div className="stack">
          {p.medical_history && (
            <div className="card">
              <div className="card-head"><h2>Medical history</h2></div>
              <div className="card-body" style={{ whiteSpace: 'pre-wrap' }}>{p.medical_history}</div>
            </div>
          )}
          <div className="card">
            <div className="card-head"><h2>Previous visits</h2><span className="sub">{data.previous_visits.length}</span></div>
            <div className="card-body" style={{ maxHeight: 640, overflowY: 'auto' }}>
              {data.previous_visits.length ? data.previous_visits.map((v) => <VisitCard key={v.id} v={v} />) : <Empty>First visit — no history yet</Empty>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
