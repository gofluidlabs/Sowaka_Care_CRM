import { Search, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, qs } from '../api'
import type { Patient } from '../types'
import { fmtDate } from '../utils'
import { Avatar } from './ui'

interface Props {
  onSelect: (p: Patient) => void
  onCreate?: (query: string) => void
  placeholder?: string
  autoFocus?: boolean
  large?: boolean
}

/** Search-as-you-type by name, phone or patient ID. */
export default function PatientSearch({ onSelect, onCreate, placeholder, autoFocus, large }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hl, setHl] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const id = setTimeout(async () => {
      try {
        const res = await api.get<{ items: Patient[] }>(`/api/patients${qs({ q: term, limit: 8 })}`)
        setResults(res.items)
        setHl(0)
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (p: Patient) => {
    setOpen(false)
    setQ('')
    onSelect(p)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setHl((h) => Math.min(h + 1, results.length - 1))
    else if (e.key === 'ArrowUp') setHl((h) => Math.max(h - 1, 0))
    else if (e.key === 'Enter' && results[hl]) pick(results[hl])
    else if (e.key === 'Escape') setOpen(false)
  }

  const showBox = open && q.trim().length >= 2

  return (
    <div className="search" ref={box}>
      <Search className="lead" />
      <input
        className={`input${large ? ' lg' : ''}`}
        placeholder={placeholder ?? 'Search by name, phone or patient ID'}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        aria-label="Search patients"
      />
      {showBox && (
        <div className="search-results">
          {loading && !results.length && <div className="search-item muted">Searching…</div>}
          {!loading && !results.length && <div className="search-item muted">No patient found for “{q.trim()}”</div>}
          {results.map((p, i) => (
            <div key={p.id} className={`search-item${i === hl ? ' hl' : ''}`} onMouseEnter={() => setHl(i)} onMouseDown={() => pick(p)}>
              <Avatar name={p.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{p.name}</div>
                <div className="small muted">
                  {p.patient_code} · {p.phone}
                  {p.age !== null && ` · ${p.age} yrs`}
                  {p.gender && ` · ${p.gender}`}
                </div>
              </div>
              <div className="small muted right">
                {p.primary_doctor_name}
                {p.last_visit && <div>Last visit {fmtDate(p.last_visit, { day: 'numeric', month: 'short' })}</div>}
              </div>
            </div>
          ))}
          {onCreate && !loading && (
            <div className="search-item" onMouseDown={() => onCreate(q.trim())} style={{ color: 'var(--brand)' }}>
              <UserPlus size={18} />
              <span className="strong">Register “{q.trim()}” as a new patient</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
