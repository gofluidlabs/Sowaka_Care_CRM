import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { HOME_BY_ROLE, useAuth } from '../auth'
import { ErrorBox, useToast } from '../components/ui'
import type { User } from '../types'

export default function ChangePassword() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const forced = user.must_change_password

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return setError('New passwords do not match')
    if (next.length < 6) return setError('Password must be at least 6 characters')
    setBusy(true)
    setError(null)
    try {
      const u = await api.post<User>('/api/auth/change-password', { current_password: current, new_password: next })
      setUser(u)
      toast('Password updated')
      navigate(HOME_BY_ROLE[u.role], { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-form" style={{ minHeight: '100vh' }}>
      <div className="login-card card card-body" style={{ padding: 28 }}>
        <div className="feed-icon" style={{ width: 44, height: 44, background: 'var(--brand-soft)', color: 'var(--brand)', marginBottom: 14 }}>
          <KeyRound />
        </div>
        <h1 style={{ fontSize: 22 }}>{forced ? 'Set your password' : 'Change password'}</h1>
        <p className="muted" style={{ margin: '6px 0 20px' }}>
          {forced ? `Welcome, ${user.name}. You signed in with a temporary password — please choose your own to continue.` : 'Choose a new password.'}
        </p>
        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <ErrorBox message={error} />
          <div className="field">
            <label>{forced ? 'Temporary password' : 'Current password'}</label>
            <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>New password</label>
            <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
            <span className="hint">At least 6 characters</span>
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="btn primary lg" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
          <button type="button" className="btn ghost" onClick={forced ? logout : () => navigate(-1)}>
            {forced ? 'Log out' : 'Cancel'}
          </button>
        </form>
      </div>
    </div>
  )
}
