import { ArrowLeft, CalendarPlus, Droplet, Pencil, Phone, ShieldAlert, Stethoscope, User as UserIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import QueueList from '../components/QueueList'
import VisitCard from '../components/VisitCard'
import { Avatar, Empty, ErrorBox, Loading, Modal, Tabs, useToast } from '../components/ui'
import type { Appointment, Patient, Payment, TimelineEvent, Visit } from '../types'
import { fmtDate, money, relativeTime, useFetch } from '../utils'

interface Profile {
  patient: Patient
  appointments: Appointment[]
  visits: Visit[]
  payments: Payment[]
  timeline: TimelineEvent[]
  permissions: { clinical: boolean; financial: boolean }
}

type Tab = 'overview' | 'timeline' | 'appointments' | 'visits' | 'prescriptions' | 'payments'

export default function PatientProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, reload } = useFetch<Profile>(`/api/patients/${id}`)
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const { patient: p, permissions } = data
  const isDesk = user?.role !== 'doctor'
  const upcoming = data.appointments.filter((a) => ['scheduled', 'waiting', 'with_doctor'].includes(a.status))
  const lastVisit = data.visits[0]
  const totalPaid = data.payments.reduce((s, x) => s + x.amount, 0)
  const rxVisits = data.visits.filter((v) => v.prescriptions.length)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'appointments', label: 'Appointments', count: data.appointments.length },
  ]
  if (permissions.clinical) {
    tabs.push({ key: 'visits', label: 'Visits', count: data.visits.length })
    tabs.push({ key: 'prescriptions', label: 'Prescriptions', count: rxVisits.length })
  }
  if (permissions.financial) tabs.push({ key: 'payments', label: 'Payments', count: data.payments.length })

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
              <span><Phone /> {p.phone}</span>
              <span><UserIcon /> {p.age !== null ? `${p.age} yrs` : 'Age —'}{p.gender && ` · ${p.gender}`}</span>
              {p.blood_group && <span><Droplet /> {p.blood_group}</span>}
              {p.primary_doctor_name && <span><Stethoscope /> {p.primary_doctor_name}</span>}
            </div>
            {permissions.clinical && p.allergies && (
              <div className="chip warn" style={{ marginTop: 8 }}><ShieldAlert size={13} /> Allergies: {p.allergies}</div>
            )}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setEditing(true)}><Pencil /> Edit</button>
            {isDesk && (
              <Link to={`/appointments/new?patient=${p.id}`} className="btn primary"><CalendarPlus /> Book appointment</Link>
            )}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid g-main">
          <div className="stack">
            {upcoming.length > 0 && (
              <div className="card">
                <div className="card-head"><h2>Current & upcoming</h2></div>
                <QueueList items={upcoming} onChanged={reload} showDate />
              </div>
            )}
            {permissions.clinical ? (
              <div className="card">
                <div className="card-head"><h2>Last visit</h2>{lastVisit && <span className="sub">{relativeTime(lastVisit.created_at)}</span>}</div>
                <div className="card-body">{lastVisit ? <VisitCard v={lastVisit} /> : <Empty>No visits recorded yet</Empty>}</div>
              </div>
            ) : (
              <div className="card">
                <div className="card-head"><h2>Recent timeline</h2></div>
                <div className="card-body"><Timeline events={data.timeline.slice(0, 6)} /></div>
              </div>
            )}
            {permissions.clinical && (
              <div className="card">
                <div className="card-head"><h2>Medical history</h2></div>
                <div className="card-body" style={{ whiteSpace: 'pre-wrap' }}>
                  {p.medical_history || <span className="muted">No medical history recorded. Use Edit to add it.</span>}
                </div>
              </div>
            )}
          </div>
          <div className="stack">
            <div className="card">
              <div className="card-head"><h2>Details</h2></div>
              <div className="card-body">
                <dl className="kv" style={{ margin: 0 }}>
                  <dt>Date of birth</dt><dd>{fmtDate(p.dob)}</dd>
                  <dt>Address</dt><dd>{p.address || '—'}</dd>
                  <dt>Emergency contact</dt>
                  <dd>{p.emergency_contact_name || '—'}{p.emergency_contact_phone && <div className="small muted">{p.emergency_contact_phone}</div>}</dd>
                  <dt>Registered</dt><dd>{fmtDate(p.created_at)}{p.created_by_name && <div className="small muted">by {p.created_by_name}</div>}</dd>
                </dl>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h2>Summary</h2></div>
              <div className="card-body">
                <dl className="kv" style={{ margin: 0 }}>
                  <dt>Appointments</dt><dd>{data.appointments.length}</dd>
                  {permissions.clinical && <><dt>Visits</dt><dd>{data.visits.length}</dd></>}
                  {permissions.financial && <><dt>Total paid</dt><dd>{money(totalPaid)}</dd></>}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="card card-body"><Timeline events={data.timeline} /></div>
      )}

      {tab === 'appointments' && (
        <div className="card"><QueueList items={data.appointments} onChanged={reload} showDate /></div>
      )}

      {tab === 'visits' && (
        <div className="card card-body">
          {data.visits.length ? data.visits.map((v) => <VisitCard key={v.id} v={v} />) : <Empty>No visits recorded yet</Empty>}
        </div>
      )}

      {tab === 'prescriptions' && (
        <div className="card">
          {rxVisits.length === 0 ? <Empty>No prescriptions yet</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Instructions</th><th>Doctor</th></tr></thead>
                <tbody>
                  {rxVisits.flatMap((v) => v.prescriptions.map((rx, i) => (
                    <tr key={`${v.id}-${i}`}>
                      <td className="muted">{i === 0 ? fmtDate(v.created_at) : ''}</td>
                      <td className="strong">{rx.medicine}</td>
                      <td>{rx.dosage}</td>
                      <td>{rx.duration}</td>
                      <td className="muted">{rx.instructions}</td>
                      <td>{i === 0 ? v.doctor_name : ''}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          {data.payments.length === 0 ? <Empty>No payments recorded</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Doctor</th><th>Mode</th><th>Recorded by</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {data.payments.map((x) => (
                    <tr key={x.id}>
                      <td>{fmtDate(x.created_at)}</td>
                      <td>{x.doctor_name ?? '—'}</td>
                      <td>{x.payment_method.toUpperCase()}</td>
                      <td className="muted">{x.created_by_name}</td>
                      <td className="num strong">{money(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && <EditPatient p={p} role={user!.role} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  )
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <Empty>No history</Empty>
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <div key={i} className="tl-item">
          <span className={`tl-dot ${e.type}`} />
          <div className="tl-date">{fmtDate(e.at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <div className="tl-title">{e.title}</div>
          <div className="tl-detail">{e.detail}</div>
        </div>
      ))}
    </div>
  )
}

function EditPatient({ p, role, onClose, onSaved }: { p: Patient; role: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const basic = role !== 'doctor'
  const clinical = role !== 'front_desk'
  const [f, setF] = useState({
    name: p.name, phone: p.phone, dob: p.dob ?? '', gender: p.gender ?? '', address: p.address ?? '',
    emergency_contact_name: p.emergency_contact_name ?? '', emergency_contact_phone: p.emergency_contact_phone ?? '',
    blood_group: p.blood_group ?? '', medical_history: p.medical_history ?? '', allergies: p.allergies ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    setBusy(true)
    setError(null)
    const body: Record<string, string | null> = {}
    if (basic) {
      Object.assign(body, {
        name: f.name, phone: f.phone, dob: f.dob || null, gender: f.gender || null, address: f.address || null,
        emergency_contact_name: f.emergency_contact_name || null, emergency_contact_phone: f.emergency_contact_phone || null,
      })
    }
    body.blood_group = f.blood_group || null
    if (clinical) Object.assign(body, { medical_history: f.medical_history || null, allergies: f.allergies || null })
    try {
      await api.patch(`/api/patients/${p.id}`, body)
      toast('Patient details updated')
      onSaved()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit patient" wide onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </>
    }>
      <div className="stack">
        <ErrorBox message={error} />
        <div className="form-grid">
          {basic && (
            <>
              <div className="field"><label>Name</label><input className="input" value={f.name} onChange={set('name')} /></div>
              <div className="field"><label>Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
              <div className="field"><label>Date of birth</label><input className="input" type="date" value={f.dob} onChange={set('dob')} /></div>
              <div className="field">
                <label>Gender</label>
                <select className="select" value={f.gender} onChange={set('gender')}>
                  <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="field span-2"><label>Address</label><input className="input" value={f.address} onChange={set('address')} /></div>
              <div className="field"><label>Emergency contact</label><input className="input" value={f.emergency_contact_name} onChange={set('emergency_contact_name')} /></div>
              <div className="field"><label>Emergency phone</label><input className="input" value={f.emergency_contact_phone} onChange={set('emergency_contact_phone')} /></div>
            </>
          )}
          <div className="field">
            <label>Blood group</label>
            <select className="select" value={f.blood_group} onChange={set('blood_group')}>
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          {clinical && (
            <>
              <div className="field"><label>Allergies</label><input className="input" value={f.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" /></div>
              <div className="field span-2"><label>Medical history</label><textarea className="textarea" value={f.medical_history} onChange={set('medical_history')} placeholder="Chronic conditions, past surgeries, ongoing medication…" /></div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
