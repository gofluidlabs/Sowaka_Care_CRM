import { useEffect, useState } from 'react'
import { api, qs } from '../api'
import ActivityFeed from '../components/ActivityFeed'
import { ErrorBox, Loading } from '../components/ui'
import type { Activity as ActivityT, User } from '../types'
import { useFetch } from '../utils'

const PAGE = 60

export default function Activity() {
  const users = useFetch<User[]>('/api/users').data ?? []
  const [userId, setUserId] = useState('')
  const [logins, setLogins] = useState(false)
  const [items, setItems] = useState<ActivityT[] | null>(null)
  const [more, setMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (before?: number) => {
    try {
      const page = await api.get<ActivityT[]>(`/api/activity${qs({ user_id: userId, limit: PAGE, before, include_logins: logins })}`)
      setItems((prev) => (before && prev ? [...prev, ...page] : page))
      setMore(page.length === PAGE)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    setItems(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, logins])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Hospital activity</h1>
          <p>Every registration, booking, consultation and payment — with who did it and when.</p>
        </div>
        <div className="actions">
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: 220 }}>
            <option value="">Everyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <label className="check small">
            <input type="checkbox" checked={logins} onChange={(e) => setLogins(e.target.checked)} /> Show logins
          </label>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="card">
        {items ? <ActivityFeed items={items} showDate /> : <Loading />}
      </div>
      {items && more && items.length > 0 && (
        <div className="row mt" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => load(items[items.length - 1].id)}>Load older activity</button>
        </div>
      )}
    </div>
  )
}
