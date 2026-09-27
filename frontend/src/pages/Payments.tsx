import { IndianRupee } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { qs } from '../api'
import PaymentModal from '../components/PaymentModal'
import { Empty, ErrorBox, Loading, PayBadge, Stat, StatusBadge } from '../components/ui'
import type { Appointment, Payment } from '../types'
import { addDays, fmt12, fmtDate, fmtTime, money, todayISO, useFetch } from '../utils'

interface PaymentList {
  total: number
  by_method: Record<string, number>
  items: Payment[]
}

export default function Payments() {
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(todayISO())
  const list = useFetch<PaymentList>(`/api/payments${qs({ date_from: from, date_to: to })}`)
  const dues = useFetch<Appointment[]>('/api/payments/dues')
  const [paying, setPaying] = useState<Appointment | null>(null)
  const isToday = from === todayISO() && to === todayISO()

  const refresh = () => {
    list.reload()
    dues.reload()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p>Collections and pending dues</p>
        </div>
        <div className="actions">
          <button className={`btn${isToday ? ' primary' : ''}`} onClick={() => { setFrom(todayISO()); setTo(todayISO()) }}>Today</button>
          <button className="btn" onClick={() => { setFrom(addDays(todayISO(), -6)); setTo(todayISO()) }}>Last 7 days</button>
          <input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} style={{ width: 150 }} />
          <span className="muted">to</span>
          <input className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} style={{ width: 150 }} />
        </div>
      </div>

      {list.data && (
        <div className="stats">
          <Stat label={isToday ? "Today's collection" : 'Collected'} value={money(list.data.total)} hero hint={`${list.data.items.length} payments`} />
          <Stat label="UPI" value={money(list.data.by_method.upi)} />
          <Stat label="Cash" value={money(list.data.by_method.cash)} />
          <Stat label="Card" value={money(list.data.by_method.card)} />
          <Stat label="Pending dues" value={dues.data ? money(dues.data.reduce((s, a) => s + a.fee - a.amount_paid, 0)) : '—'} dot="var(--amber)" hint="Last 30 days" />
        </div>
      )}

      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Collections</h2></div>
          <ErrorBox message={list.error} />
          {!list.data ? <Loading /> : list.data.items.length === 0 ? <Empty>No payments in this period</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Mode</th><th>By</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {list.data.items.map((p) => (
                    <tr key={p.id}>
                      <td className="tabular muted">{isToday ? fmtTime(p.created_at) : `${fmtDate(p.created_at, { day: 'numeric', month: 'short' })}, ${fmtTime(p.created_at)}`}</td>
                      <td><Link to={`/patients/${p.patient_id}`} className="strong" style={{ color: 'var(--ink)' }}>{p.patient_name}</Link><div className="code">{p.patient_code}</div></td>
                      <td>{p.doctor_name ?? '—'}</td>
                      <td>{p.payment_method.toUpperCase()}</td>
                      <td className="muted">{p.created_by_name}</td>
                      <td className="num strong">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h2>Pending dues</h2><span className="sub">{dues.data?.length ?? 0} visits</span></div>
          {!dues.data ? <Loading /> : dues.data.length === 0 ? <Empty>All dues cleared 🎉</Empty> : dues.data.map((a) => (
            <div key={a.id} className="queue-item">
              <div className="who">
                <Link to={`/patients/${a.patient_id}`} className="name" style={{ color: 'var(--ink)' }}>{a.patient_name}</Link>
                <div className="meta">{fmtDate(a.appointment_date, { day: 'numeric', month: 'short' })} {fmt12(a.appointment_time)} · {a.doctor_name}</div>
                <div className="row" style={{ marginTop: 4 }}><StatusBadge status={a.status} /><PayBadge status={a.payment_status} /></div>
              </div>
              <div className="right">
                <div className="strong">{money(a.fee - a.amount_paid)}</div>
                <button className="btn sm" style={{ marginTop: 4 }} onClick={() => setPaying(a)}><IndianRupee /> Collect</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {paying && <PaymentModal appt={paying} onClose={() => setPaying(null)} onDone={refresh} />}
    </div>
  )
}
