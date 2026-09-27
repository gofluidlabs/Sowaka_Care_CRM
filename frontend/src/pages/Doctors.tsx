import { UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, ErrorBox, Loading } from '../components/ui'
import type { Doctor } from '../types'
import { money, relativeTime, useFetch } from '../utils'

export default function Doctors() {
  const navigate = useNavigate()
  const { data, error } = useFetch<Doctor[]>('/api/doctors?include_inactive=true', 60000)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Doctors</h1>
          <p>{data.filter((d) => d.status === 'active').length} active doctors · today's workload</p>
        </div>
        <Link to="/users?new=doctor" className="btn primary"><UserPlus /> Add doctor</Link>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
        {data.map((d) => {
          const t = d.today!
          return (
            <div key={d.id} className="card card-body" style={{ cursor: 'pointer', opacity: d.status === 'active' ? 1 : 0.6 }} onClick={() => navigate(`/doctors/${d.id}`)}>
              <div className="row" style={{ gap: 12, marginBottom: 14 }}>
                <Avatar name={d.name} doc lg />
                <div style={{ minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: 15 }}>{d.name}</div>
                  <div className="small muted">{d.specialization} · {d.code}</div>
                  <div className="small muted">{d.department}</div>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', textAlign: 'center' }}>
                <div><div className="stat-value" style={{ fontSize: 20 }}>{t.patients}</div><div className="small muted">Patients</div></div>
                <div><div className="stat-value" style={{ fontSize: 20 }}>{t.completed}</div><div className="small muted">Completed</div></div>
                <div><div className="stat-value" style={{ fontSize: 20 }}>{t.pending}</div><div className="small muted">Pending</div></div>
              </div>
              <div className="divider" />
              <div className="row small muted" style={{ justifyContent: 'space-between' }}>
                <span>Fee {money(d.consultation_fee)}</span>
                <span>{d.status === 'active' ? `Active ${relativeTime(d.last_active)}` : 'Inactive'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
