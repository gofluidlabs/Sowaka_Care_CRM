import { Fragment, useState } from 'react'
import { BarList, ColumnChart, LineChart } from '../components/Charts'
import { ErrorBox, Loading, Segmented, Stat } from '../components/ui'
import { compactMoney, fmtDate, money, useFetch } from '../utils'

interface AnalyticsData {
  days: number
  patients: { today: number; week: number; month: number; in_range: number; new: number; returning: number; avg_daily: number }
  appointments: { total: number; completed: number; cancelled: number; no_show: number; pending: number }
  revenue: { today: number; week: number; month: number; in_range: number; by_method: Record<string, number> }
  series: { date: string; patients: number; revenue: number }[]
  doctors: { id: number; name: string; specialization: string | null; patients: number; appointments: number; completed: number; revenue: number }[]
  peak_hours: { hour: number; appointments: number }[]
  registrations_by_staff: { name: string; count: number }[]
  pending_consultations: number
}

const METHOD_COLORS: Record<string, string> = { upi: '#0f766e', cash: '#f59e0b', card: '#2563eb', other: '#94a3b8' }

export default function Analytics() {
  const [days, setDays] = useState(30)
  const { data, error } = useFetch<AnalyticsData>(`/api/analytics?days=${days}`)
  if (error) return <ErrorBox message={error} />

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Patients, appointments, revenue and operations</p>
        </div>
        <Segmented value={days} onChange={setDays} options={[
          { value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' },
        ]} />
      </div>
      {!data ? <Loading /> : <Body d={data} />}
    </div>
  )
}

function Body({ d }: { d: AnalyticsData }) {
  const a = d.appointments
  const statusParts = [
    { label: 'Completed', value: a.completed, color: 'var(--green)' },
    { label: 'Pending', value: a.pending, color: '#94a3b8' },
    { label: 'Cancelled', value: a.cancelled, color: 'var(--red)' },
    { label: 'No-show', value: a.no_show, color: '#f59e0b' },
  ]
  const methodTotal = Object.values(d.revenue.by_method).reduce((s, v) => s + v, 0) || 1
  const newPct = d.patients.in_range ? Math.round((d.patients.new / d.patients.in_range) * 100) : 0
  const short = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'short' })

  return (
    <div className="stack">
      <div className="stats" style={{ marginBottom: 0 }}>
        <Stat label="Patients today" value={d.patients.today} hero />
        <Stat label="This week" value={d.patients.week} />
        <Stat label="This month" value={d.patients.month} />
        <Stat label="Avg. daily patients" value={d.patients.avg_daily} />
        <Stat label="Collection today" value={money(d.revenue.today)} />
        <Stat label="This week" value={money(d.revenue.week)} />
        <Stat label="This month" value={money(d.revenue.month)} />
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-head"><h2>Patient trend</h2><span className="sub">Unique patients per day</span></div>
          <div className="card-body">
            <LineChart data={d.series.map((s) => ({ label: short(s.date), value: s.patients }))} format={(n) => String(Math.round(n))} />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Collection trend</h2><span className="sub">{money(d.revenue.in_range)} in period</span></div>
          <div className="card-body">
            <LineChart data={d.series.map((s) => ({ label: short(s.date), value: s.revenue }))} format={compactMoney} color="#2563eb" />
          </div>
        </div>
      </div>

      <div className="grid g-3">
        <div className="card">
          <div className="card-head"><h2>Appointments</h2><span className="sub">{a.total} total</span></div>
          <div className="card-body stack">
            <div className="split-bar">
              {statusParts.filter((s) => s.value).map((s) => (
                <div key={s.label} style={{ flex: s.value, background: s.color }} title={`${s.label}: ${s.value}`} />
              ))}
            </div>
            <dl className="kv" style={{ margin: 0, gridTemplateColumns: '1fr auto' }}>
              {statusParts.map((s) => (
                <Fragment key={s.label}><dt><span className="dot" style={{ background: s.color, width: 8, height: 8, borderRadius: 4, display: 'inline-block', marginRight: 8 }} />{s.label}</dt>
                  <dd className="right tabular">{s.value}</dd></Fragment>
              ))}
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>New vs returning</h2><span className="sub">{d.patients.in_range} patients</span></div>
          <div className="card-body stack">
            <div className="split-bar">
              <div style={{ flex: d.patients.new || 0.001, background: 'var(--brand)' }} />
              <div style={{ flex: d.patients.returning || 0.001, background: '#99d5cc' }} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><div className="stat-value" style={{ fontSize: 22 }}>{d.patients.new}</div><div className="small muted">New ({newPct}%)</div></div>
              <div className="right"><div className="stat-value" style={{ fontSize: 22 }}>{d.patients.returning}</div><div className="small muted">Returning ({100 - newPct}%)</div></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Payment modes</h2></div>
          <div className="card-body stack">
            <div className="split-bar">
              {Object.entries(d.revenue.by_method).map(([m, v]) => <div key={m} style={{ flex: v, background: METHOD_COLORS[m] }} />)}
            </div>
            <dl className="kv" style={{ margin: 0, gridTemplateColumns: '1fr auto' }}>
              {Object.entries(d.revenue.by_method).sort((x, y) => y[1] - x[1]).map(([m, v]) => (
                <Fragment key={m}><dt><span style={{ background: METHOD_COLORS[m], width: 8, height: 8, borderRadius: 4, display: 'inline-block', marginRight: 8 }} />{m.toUpperCase()}</dt>
                  <dd className="right tabular">{money(v)} <span className="muted small">({Math.round((v / methodTotal) * 100)}%)</span></dd></Fragment>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-head"><h2>Doctor workload</h2><span className="sub">Unique patients</span></div>
          <div className="card-body">
            <BarList data={d.doctors.map((x) => ({ label: x.name, value: x.patients }))} />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Peak hours</h2><span className="sub">Appointments by hour of day</span></div>
          <div className="card-body">
            <ColumnChart data={d.peak_hours.map((h) => ({ label: `${((h.hour + 11) % 12) + 1}${h.hour < 12 ? 'a' : 'p'}`, value: h.appointments }))} />
          </div>
        </div>
      </div>

      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Doctor performance</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Doctor</th><th className="num">Patients</th><th className="num">Appointments</th><th className="num">Completed</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {d.doctors.map((x) => (
                  <tr key={x.id}>
                    <td><div className="strong">{x.name}</div><div className="small muted">{x.specialization}</div></td>
                    <td className="num">{x.patients}</td>
                    <td className="num">{x.appointments}</td>
                    <td className="num">{x.completed}</td>
                    <td className="num strong">{money(x.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Front-desk registrations</h2></div>
            <div className="card-body">
              {d.registrations_by_staff.length
                ? <BarList data={d.registrations_by_staff.map((r) => ({ label: r.name, value: r.count }))} color="#2563eb" />
                : <span className="muted">No registrations in this period</span>}
            </div>
          </div>
          <Stat label="Pending consultations" value={d.pending_consultations} hint="Open appointments up to today" />
        </div>
      </div>
    </div>
  )
}
