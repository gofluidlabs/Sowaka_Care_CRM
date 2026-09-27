import { Stethoscope } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import PatientSearch from '../components/PatientSearch'
import QueueList from '../components/QueueList'
import { ErrorBox, Loading, Stat } from '../components/ui'
import type { Appointment, Counts, Doctor } from '../types'
import { firstName, fmt12, greeting, useFetch } from '../utils'

interface DoctorData {
  doctor: Doctor
  counts: Counts
  queue: Appointment[]
  upcoming: Appointment[]
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, reload } = useFetch<DoctorData>('/api/dashboard/doctor', 20000)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const c = data.counts
  const current = data.queue.find((a) => a.status === 'with_doctor')
  const nextUp = data.queue.find((a) => a.status === 'waiting')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {firstName(user!.name)}</h1>
          <p>{data.doctor.specialization} · {data.doctor.department}</p>
        </div>
        <div style={{ width: 360, maxWidth: '100%' }}>
          <PatientSearch placeholder="Find one of your patients" onSelect={(p) => navigate(`/patients/${p.id}`)} />
        </div>
      </div>

      <div className="stats">
        <Stat label="Today's patients" value={c.patients} hero />
        <Stat label="Waiting" value={c.waiting} dot="var(--amber)" />
        <Stat label="Completed" value={c.completed} dot="var(--green)" />
        <Stat label="Yet to arrive" value={c.scheduled} dot="#94a3b8" />
      </div>

      {(current || nextUp) && (
        <div className="card card-body" style={{ marginBottom: 16, borderColor: 'var(--brand)', background: 'var(--brand-soft)' }}>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="feed-icon done" style={{ width: 40, height: 40, background: 'var(--brand)', color: '#fff' }}><Stethoscope /></div>
              <div>
                <div className="small muted strong">{current ? 'IN CONSULTATION' : 'NEXT PATIENT'}</div>
                <div className="strong" style={{ fontSize: 16 }}>{(current ?? nextUp)!.patient_name}</div>
                <div className="small muted">
                  {fmt12((current ?? nextUp)!.appointment_time)} · {(current ?? nextUp)!.reason || 'Consultation'}
                </div>
              </div>
            </div>
            <button className="btn primary lg" onClick={() => navigate(`/consult/${(current ?? nextUp)!.id}`)}>
              {current ? 'Continue consultation' : 'Start consultation'}
            </button>
          </div>
        </div>
      )}

      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Today's queue</h2><span className="sub">Auto-refreshes</span></div>
          <QueueList items={data.queue} onChanged={reload} showDoctor={false} emptyText="No patients booked for today" />
        </div>
        <div className="card">
          <div className="card-head"><h2>Coming up this week</h2></div>
          <QueueList items={data.upcoming} onChanged={reload} showDoctor={false} showDate emptyText="Nothing scheduled" />
        </div>
      </div>
    </div>
  )
}
