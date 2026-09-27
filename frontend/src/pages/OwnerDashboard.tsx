import { useNavigate, Link } from 'react-router-dom'
import ActivityFeed from '../components/ActivityFeed'
import { LineChart } from '../components/Charts'
import { Avatar, Empty, ErrorBox, Loading, Stat, StatusBadge } from '../components/ui'
import type { Activity, Appointment, Counts, Doctor } from '../types'
import { fmt12, fmtDate, greeting, money, useFetch } from '../utils'

interface OwnerData {
  counts: Counts
  collection_today: number
  collection_yesterday: number
  new_registrations: number
  doctors: Doctor[]
  live_queue: Appointment[]
  trend: { date: string; patients: number }[]
  activity: Activity[]
}

export default function OwnerDashboard() {
  const navigate = useNavigate()
  const { data, error } = useFetch<OwnerData>('/api/dashboard/owner', 30000)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const c = data.counts
  const delta = data.collection_today - data.collection_yesterday

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{greeting()} — here's the hospital right now</h1>
          <p>Live view · refreshes every 30 seconds</p>
        </div>
      </div>

      <div className="stats">
        <Stat label="Today's patients" value={c.patients} hint={`${data.new_registrations} new registrations`} hero />
        <Stat label="Appointments" value={c.appointments} />
        <Stat label="Completed" value={c.completed} dot="var(--green)" />
        <Stat label="Waiting now" value={c.waiting + c.with_doctor} dot="var(--amber)" hint={`${c.with_doctor} with doctor`} />
        <Stat label="Pending" value={c.scheduled} dot="#94a3b8" hint="Yet to arrive" />
        <Stat label="Cancelled / no-show" value={c.cancelled} dot="var(--red)" />
        <Stat
          label="Today's collection"
          value={money(data.collection_today)}
          hint={<span style={{ color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>{delta >= 0 ? '▲' : '▼'} {money(Math.abs(delta))} vs yesterday</span>}
        />
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Doctors today</h2>
              <Link to="/doctors" className="small">All doctors →</Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Doctor</th><th className="num">Patients</th><th className="num">Completed</th><th className="num">Waiting</th><th className="num">Pending</th><th style={{ width: '28%' }}>Progress</th></tr>
                </thead>
                <tbody>
                  {data.doctors.map((d) => {
                    const t = d.today!
                    const pct = t.patients ? (t.completed / t.patients) * 100 : 0
                    return (
                      <tr key={d.id} className="click" onClick={() => navigate(`/doctors/${d.id}`)}>
                        <td>
                          <div className="row" style={{ gap: 10 }}>
                            <Avatar name={d.name} doc />
                            <div><div className="strong">{d.name}</div><div className="small muted">{d.specialization}</div></div>
                          </div>
                        </td>
                        <td className="num strong">{t.patients}</td>
                        <td className="num">{t.completed}</td>
                        <td className="num">{t.waiting}</td>
                        <td className="num">{t.pending}</td>
                        <td><div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Patients — last 7 days</h2><Link to="/analytics" className="small">Analytics →</Link></div>
            <div className="card-body">
              <LineChart
                data={data.trend.map((t) => ({
                  label: fmtDate(t.date, { weekday: 'short' }),
                  value: t.patients,
                  tip: fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' }),
                }))}
                height={190}
                format={(n) => String(Math.round(n))}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>In the building</h2><span className="sub">Waiting & in consultation</span></div>
            {data.live_queue.length === 0 ? <Empty>No one is waiting right now</Empty> : data.live_queue.map((a) => (
              <div key={a.id} className={`queue-item${a.status === 'with_doctor' ? ' now' : ''}`}>
                <div className="time">{fmt12(a.appointment_time)}</div>
                <div className="who">
                  <Link to={`/patients/${a.patient_id}`} className="name" style={{ color: 'var(--ink)' }}>{a.patient_name}</Link>
                  <div className="meta">{a.doctor_name}{a.reason && ` · ${a.reason}`}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h2>Hospital activity</h2><Link to="/activity" className="small">View all →</Link></div>
          <ActivityFeed items={data.activity} />
        </div>
      </div>
    </div>
  )
}
