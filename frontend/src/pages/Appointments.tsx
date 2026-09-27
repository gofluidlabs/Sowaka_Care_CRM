import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { qs } from '../api'
import { useAuth } from '../auth'
import { useDoctors } from '../components/BookingFields'
import QueueList from '../components/QueueList'
import { ErrorBox, Loading, Stat } from '../components/ui'
import type { Appointment } from '../types'
import { STATUS_LABEL, addDays, fmtDate, todayISO, useFetch } from '../utils'

export default function Appointments() {
  const { user } = useAuth()
  const [day, setDay] = useState(todayISO())
  const [doctorId, setDoctorId] = useState('')
  const [status, setStatus] = useState('')
  const doctors = useDoctors()
  const isDoctor = user?.role === 'doctor'
  const { data, error, reload } = useFetch<Appointment[]>(
    `/api/appointments${qs({ date: day, doctor_id: doctorId, status })}`,
    day === todayISO() ? 30000 : undefined,
  )
  const isToday = day === todayISO()
  const list = data ?? []
  const count = (s: string[]) => list.filter((a) => s.includes(a.status)).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{isToday ? "Today's appointments" : 'Appointments'}</h1>
          <p>{fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="actions">
          <div className="row" style={{ gap: 4 }}>
            <button className="btn icon" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><ChevronLeft /></button>
            <input className="input" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} style={{ width: 160 }} />
            <button className="btn icon" onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><ChevronRight /></button>
            {!isToday && <button className="btn" onClick={() => setDay(todayISO())}>Today</button>}
          </div>
          {!isDoctor && (
            <select className="select" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} style={{ width: 190 }}>
              <option value="">All doctors</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {!isDoctor && (
            <Link to="/appointments/new" className="btn primary"><CalendarPlus /> New</Link>
          )}
        </div>
      </div>

      {!status && data && (
        <div className="stats">
          <Stat label="Total" value={list.length} />
          <Stat label="Not arrived" value={count(['scheduled'])} dot="#94a3b8" />
          <Stat label="Waiting" value={count(['waiting'])} dot="var(--amber)" />
          <Stat label="With doctor" value={count(['with_doctor'])} dot="var(--violet)" />
          <Stat label="Completed" value={count(['completed'])} dot="var(--green)" />
          <Stat label="Cancelled / no-show" value={count(['cancelled', 'no_show'])} dot="var(--red)" />
        </div>
      )}

      <ErrorBox message={error} />
      <div className="card">
        {data ? <QueueList items={list} onChanged={reload} showDoctor={!isDoctor} emptyText="No appointments for this day" /> : <Loading />}
      </div>
    </div>
  )
}
