import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { qs } from '../api'
import ActivityFeed from '../components/ActivityFeed'
import { Avatar, ErrorBox, Loading, Modal } from '../components/ui'
import type { Activity, User } from '../types'
import { relativeTime, useFetch } from '../utils'

type StaffUser = User & {
  today: { patients_registered: number; appointments_created: number; payments_recorded: number; arrivals_marked: number; total_actions: number }
}

export default function Staff() {
  const { data, error } = useFetch<StaffUser[]>('/api/staff', 60000)
  const [viewing, setViewing] = useState<StaffUser | null>(null)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const staff = data.filter((u) => u.role !== 'owner')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <p>Front desk, reception and nursing staff — today's activity and accountability</p>
        </div>
        <Link to="/users?new=front_desk" className="btn primary"><UserPlus /> Add staff</Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {staff.map((u) => (
          <div key={u.id} className="card" style={{ opacity: u.status === 'active' ? 1 : 0.6 }}>
            <div className="card-body">
              <div className="row" style={{ gap: 12 }}>
                <Avatar name={u.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strong">{u.name}</div>
                  <div className="small muted">{u.designation} · @{u.username}</div>
                </div>
                <span className={`badge b-${u.status}`}>{u.status === 'active' ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="divider" />
              <dl className="kv small" style={{ margin: 0, gridTemplateColumns: '1fr auto' }}>
                <dt>Patients registered</dt><dd className="right">{u.today.patients_registered}</dd>
                <dt>Appointments created</dt><dd className="right">{u.today.appointments_created}</dd>
                <dt>Arrivals marked</dt><dd className="right">{u.today.arrivals_marked}</dd>
                <dt>Payments recorded</dt><dd className="right">{u.today.payments_recorded}</dd>
              </dl>
              <div className="divider" />
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Last active: <span style={{ color: 'var(--ink)' }}>{relativeTime(u.last_active)}</span></span>
                <button className="link-btn" onClick={() => setViewing(u)}>Activity →</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {viewing && <StaffActivity user={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function StaffActivity({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const { data } = useFetch<Activity[]>(`/api/activity${qs({ user_id: user.id, limit: 60, include_logins: true })}`)
  return (
    <Modal title={`${user.name} — activity`} onClose={onClose} wide>
      <div style={{ margin: '-18px -20px' }}>{data ? <ActivityFeed items={data} showDate /> : <Loading />}</div>
    </Modal>
  )
}
