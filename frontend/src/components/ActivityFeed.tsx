import { Ban, CalendarPlus, CheckCircle2, IndianRupee, KeyRound, LogIn, Pill, Stethoscope, UserCog, UserPlus, UserCheck, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Activity } from '../types'
import { fmtDate, fmtTime } from '../utils'
import { Empty } from './ui'

const ICONS: Record<string, [JSX.Element, string]> = {
  'patient.registered': [<UserPlus />, 'reg'],
  'patient.updated': [<Pencil />, ''],
  'appointment.created': [<CalendarPlus />, 'appt'],
  'appointment.rescheduled': [<CalendarPlus />, 'appt'],
  'appointment.arrived': [<UserCheck />, 'appt'],
  'appointment.with_doctor': [<Stethoscope />, 'rx'],
  'appointment.completed': [<CheckCircle2 />, 'done'],
  'appointment.cancelled': [<Ban />, 'warn'],
  'appointment.no_show': [<Ban />, 'warn'],
  'prescription.added': [<Pill />, 'rx'],
  'prescription.updated': [<Pill />, 'rx'],
  'consultation.saved': [<Stethoscope />, 'rx'],
  'payment.recorded': [<IndianRupee />, 'pay'],
  'auth.login': [<LogIn />, ''],
  'auth.password_changed': [<KeyRound />, ''],
}

export default function ActivityFeed({ items, showDate }: { items: Activity[]; showDate?: boolean }) {
  if (!items.length) return <Empty>No activity yet</Empty>
  let lastDay = ''
  return (
    <div>
      {items.map((a) => {
        const [icon, cls] = ICONS[a.action] ?? [<UserCog />, '']
        const day = a.timestamp.slice(0, 10)
        const header = showDate && day !== lastDay
        lastDay = day
        return (
          <div key={a.id}>
            {header && (
              <div className="small strong muted" style={{ padding: '12px 18px 4px', background: 'var(--surface-2)' }}>
                {fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            )}
            <div className="feed-item">
              <div className="feed-time">{fmtTime(a.timestamp)}</div>
              <div className={`feed-icon ${cls}`}>{icon}</div>
              <div style={{ minWidth: 0 }}>
                <div>{a.description}</div>
                {a.entity_label && a.entity_type === 'patient' && (
                  <Link to={`/patients/${a.entity_id}`} className="code">{a.entity_label}</Link>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
