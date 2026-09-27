import { ChevronRight, IndianRupee, MoreHorizontal, Stethoscope, UserCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Appointment, AppointmentStatus } from '../types'
import { fmt12, fmtDate, visitTypeLabel } from '../utils'
import PaymentModal from './PaymentModal'
import { Empty, PayBadge, StatusBadge, useToast } from './ui'

interface Props {
  items: Appointment[]
  onChanged: () => void
  showDoctor?: boolean
  showDate?: boolean
  emptyText?: string
}

/** Appointment queue rows with role-appropriate one-click actions. */
export default function QueueList({ items, onChanged, showDoctor = true, showDate, emptyText }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [paying, setPaying] = useState<Appointment | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const isDesk = user?.role === 'front_desk' || user?.role === 'owner'
  const isDoctor = user?.role === 'doctor'

  const setStatus = async (a: Appointment, status: AppointmentStatus, msg: string) => {
    setBusy(a.id)
    try {
      await api.patch(`/api/appointments/${a.id}/status`, { status })
      toast(msg)
      onChanged()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!items.length) return <Empty>{emptyText ?? 'No appointments'}</Empty>

  return (
    <>
      {items.map((a) => {
        const done = a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show'
        return (
          <div key={a.id} className={`queue-item${a.status === 'with_doctor' ? ' now' : ''}${done ? ' done' : ''}`}>
            <div className="time">
              {fmt12(a.appointment_time)}
              {showDate && <div className="small muted" style={{ fontWeight: 400 }}>{fmtDate(a.appointment_date, { day: 'numeric', month: 'short' })}</div>}
            </div>
            <div className="who">
              <Link to={`/patients/${a.patient_id}`} className="name" style={{ color: 'var(--ink)' }}>{a.patient_name}</Link>
              <div className="meta">
                {[
                  a.patient_code,
                  a.patient_age !== null ? `${a.patient_age}y${a.patient_gender ? ' ' + a.patient_gender[0] : ''}` : null,
                  showDoctor ? a.doctor_name : null,
                  visitTypeLabel(a.visit_type),
                  a.reason,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            {isDesk && a.fee > 0 && a.status !== 'cancelled' && a.status !== 'no_show' && <PayBadge status={a.payment_status} />}
            <StatusBadge status={a.status} />
            <div className="row" style={{ minWidth: isDoctor ? 110 : 150, justifyContent: 'flex-end' }}>
              {isDesk && a.status === 'scheduled' && (
                <button className="btn sm" disabled={busy === a.id} onClick={() => setStatus(a, 'waiting', `${a.patient_name} marked as arrived`)}>
                  <UserCheck /> Arrived
                </button>
              )}
              {isDesk && a.payment_status !== 'paid' && a.fee > 0 && !['cancelled', 'no_show', 'scheduled'].includes(a.status) && (
                <button className="btn sm" onClick={() => setPaying(a)}>
                  <IndianRupee /> Collect
                </button>
              )}
              {isDoctor && (a.status === 'waiting' || a.status === 'scheduled') && (
                <button className="btn sm primary" onClick={() => navigate(`/consult/${a.id}`)}>
                  <Stethoscope /> Start
                </button>
              )}
              {isDoctor && a.status === 'with_doctor' && (
                <button className="btn sm primary" onClick={() => navigate(`/consult/${a.id}`)}>Continue</button>
              )}
              {isDoctor && a.status === 'completed' && (
                <button className="btn sm ghost" onClick={() => navigate(`/consult/${a.id}`)}>View <ChevronRight /></button>
              )}
              {isDesk && !done && <RowMenu a={a} onPick={(s, m) => setStatus(a, s, m)} />}
            </div>
          </div>
        )
      })}
      {paying && <PaymentModal appt={paying} onClose={() => setPaying(null)} onDone={onChanged} />}
    </>
  )
}

function RowMenu({ a, onPick }: { a: Appointment; onPick: (s: AppointmentStatus, msg: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const options: [AppointmentStatus, string, string][] = []
  if (a.status === 'waiting') options.push(['scheduled', 'Undo arrival', 'Arrival undone'])
  if (a.status !== 'with_doctor') {
    options.push(['no_show', 'Mark no-show', `${a.patient_name} marked no-show`])
    options.push(['cancelled', 'Cancel appointment', 'Appointment cancelled'])
  }
  if (!options.length) return null
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn sm ghost icon" onClick={() => setOpen((o) => !o)} aria-label="More actions" style={{ width: 30 }}>
        <MoreHorizontal />
      </button>
      {open && (
        <div className="pop" style={{ width: 200 }}>
          {options.map(([s, label, msg]) => (
            <div key={s} className="pop-item" onClick={() => { setOpen(false); onPick(s, msg) }}
              style={s === 'cancelled' ? { color: 'var(--red)' } : undefined}>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
