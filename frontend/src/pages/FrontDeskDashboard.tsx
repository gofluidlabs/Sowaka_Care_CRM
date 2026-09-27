import { CalendarPlus, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import PatientSearch from '../components/PatientSearch'
import QueueList from '../components/QueueList'
import { ErrorBox, Loading, Segmented, Stat } from '../components/ui'
import type { Appointment, Counts } from '../types'
import { firstName, greeting, money, useFetch } from '../utils'
import { useState } from 'react'

interface DeskData {
  counts: Counts
  new_registrations: number
  collection_today: number
  queue: Appointment[]
  my_today: { patients_registered: number; appointments_created: number; payments_recorded: number }
}

type Filter = 'all' | 'active' | 'scheduled' | 'done'

export default function FrontDeskDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, reload } = useFetch<DeskData>('/api/dashboard/front-desk', 30000)
  const [filter, setFilter] = useState<Filter>('active')

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const c = data.counts

  const queue = data.queue.filter((a) =>
    filter === 'all' ? true
      : filter === 'active' ? ['scheduled', 'waiting', 'with_doctor'].includes(a.status)
        : filter === 'scheduled' ? a.status === 'scheduled'
          : ['completed', 'cancelled', 'no_show'].includes(a.status),
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {firstName(user!.name)}</h1>
          <p>
            Today you've registered {data.my_today.patients_registered} patient{data.my_today.patients_registered !== 1 && 's'},
            booked {data.my_today.appointments_created} appointment{data.my_today.appointments_created !== 1 && 's'} and
            recorded {data.my_today.payments_recorded} payment{data.my_today.payments_recorded !== 1 && 's'}.
          </p>
        </div>
      </div>

      <div className="big-actions" style={{ marginBottom: 16 }}>
        <Link to="/register" className="big-action">
          <span className="ic"><UserPlus /></span>
          <span>Register Patient<small>New patient + first visit</small></span>
        </Link>
        <Link to="/appointments/new" className="big-action alt">
          <span className="ic"><CalendarPlus /></span>
          <span>New Appointment<small>For an existing patient</small></span>
        </Link>
      </div>

      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 8 }}>Search patient</div>
        <PatientSearch
          large
          autoFocus
          onSelect={(p) => navigate(`/patients/${p.id}`)}
          onCreate={(q) => navigate(`/register?${/^\d+$/.test(q) ? 'phone' : 'name'}=${encodeURIComponent(q)}`)}
        />
      </div>

      <div className="stats">
        <Stat label="Today's patients" value={c.patients} hint={`${data.new_registrations} new registrations`} hero />
        <Stat label="Appointments" value={c.appointments} />
        <Stat label="Waiting" value={c.waiting} dot="var(--amber)" hint={c.with_doctor ? `${c.with_doctor} with doctor` : undefined} />
        <Stat label="Completed" value={c.completed} dot="var(--green)" />
        <Stat label="Yet to arrive" value={c.scheduled} dot="#94a3b8" />
        <Stat label="Collected today" value={money(data.collection_today)} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Today's queue</h2>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'scheduled', label: 'Not arrived' },
              { value: 'done', label: 'Done' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
        <QueueList items={queue} onChanged={reload} emptyText="Nothing here right now" />
      </div>
    </div>
  )
}
