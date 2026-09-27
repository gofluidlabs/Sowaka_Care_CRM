import { Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { qs } from '../api'
import { useAuth } from '../auth'
import { Avatar, Empty, ErrorBox, Loading } from '../components/ui'
import type { Patient } from '../types'
import { fmtDate, useFetch } from '../utils'

const PAGE = 25

export default function Patients() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(0) }, 250)
    return () => clearTimeout(id)
  }, [input])
  const { data, error, loading } = useFetch<{ total: number; items: Patient[] }>(
    `/api/patients${qs({ q, limit: PAGE, offset: page * PAGE })}`,
  )
  const isDoctor = user?.role === 'doctor'
  const pages = data ? Math.ceil(data.total / PAGE) : 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{isDoctor ? 'My patients' : 'Patients'}</h1>
          <p>{data ? `${data.total} ${q ? 'matching' : isDoctor ? 'patients under your care' : 'registered patients'}` : ' '}</p>
        </div>
        {!isDoctor && <Link to="/register" className="btn primary"><UserPlus /> Register patient</Link>}
      </div>

      <div className="search" style={{ marginBottom: 16, maxWidth: 520 }}>
        <Search className="lead" />
        <input className="input lg" placeholder="Search by name, phone or patient ID" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
      </div>

      <ErrorBox message={error} />
      <div className="card">
        {!data && loading ? <Loading /> : data && data.items.length === 0 ? <Empty>No patients found</Empty> : data && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Patient ID</th>
                  <th>Phone</th>
                  <th>Age / Gender</th>
                  <th>Doctor</th>
                  <th>Last visit</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="click" onClick={() => navigate(`/patients/${p.id}`)}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={p.name} />
                        <span className="strong">{p.name}</span>
                      </div>
                    </td>
                    <td className="code">{p.patient_code}</td>
                    <td className="tabular">{p.phone}</td>
                    <td>{p.age ?? '—'}{p.gender && ` · ${p.gender}`}</td>
                    <td>{p.primary_doctor_name ?? '—'}</td>
                    <td>{fmtDate(p.last_visit)}</td>
                    <td className="muted">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="row mt" style={{ justifyContent: 'flex-end' }}>
          <span className="small muted">Page {page + 1} of {pages}</span>
          <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
