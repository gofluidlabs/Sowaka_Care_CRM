import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ActivityFeed from '../components/ActivityFeed'
import QueueList from '../components/QueueList'
import { Avatar, ErrorBox, Loading, Stat } from '../components/ui'
import type { Activity, Appointment, DayStats, Doctor } from '../types'
import { money, relativeTime, useFetch } from '../utils'

interface Detail {
  doctor: Doctor & { last_login: string | null }
  today: DayStats
  today_appointments: Appointment[]
  patients_week: number
  patients_month: number
  completed_month: number
  revenue_month: number
  activity: Activity[]
}

export default function DoctorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, reload } = useFetch<Detail>(`/api/doctors/${id}`, 30000)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const d = data.doctor
  return (
    <div>
      <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ArrowLeft /> Back</button>
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="profile-head">
          <Avatar name={d.name} doc lg />
          <div style={{ flex: 1 }}>
            <div className="code">{d.code}</div>
            <h1>{d.name}</h1>
            <div className="facts">
              <span>{d.specialization}</span>
              <span>{d.department}</span>
              <span>Fee {money(d.consultation_fee)}</span>
              <span>Last login {relativeTime(d.last_login)}</span>
            </div>
          </div>
          <span className={`badge b-${d.status}`}>{d.status === 'active' ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      <div className="stats">
        <Stat label="Patients today" value={data.today.patients} hero />
        <Stat label="Completed today" value={data.today.completed} dot="var(--green)" />
        <Stat label="Pending today" value={data.today.pending} dot="var(--amber)" />
        <Stat label="Patients (7 days)" value={data.patients_week} />
        <Stat label="Patients (30 days)" value={data.patients_month} hint={`${data.completed_month} consultations`} />
        <Stat label="Revenue (30 days)" value={money(data.revenue_month)} />
      </div>

      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Today's appointments</h2></div>
          <QueueList items={data.today_appointments} onChanged={reload} showDoctor={false} emptyText="No appointments today" />
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h2>Recent activity</h2></div>
          <ActivityFeed items={data.activity} showDate />
        </div>
      </div>
    </div>
  )
}
