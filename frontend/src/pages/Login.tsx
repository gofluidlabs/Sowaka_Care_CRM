import { Activity, Plus, ShieldCheck, Stethoscope, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { HOME_BY_ROLE, useAuth } from '../auth'
import { ErrorBox } from '../components/ui'

const DEMO = [
  { label: 'Owner / Admin', username: 'owner', password: 'owner123' },
  { label: 'Doctor — Dr. Amit Gupta', username: 'amit.gupta', password: 'doctor123' },
  { label: 'Front Desk — Priya', username: 'priya', password: 'front123' },
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.must_change_password ? '/change-password' : HOME_BY_ROLE[user.role]} replace />

  const submit = async (e?: FormEvent, creds?: { username: string; password: string }) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const u = await login(creds?.username ?? username, creds?.password ?? password)
      navigate(u.must_change_password ? '/change-password' : HOME_BY_ROLE[u.role], { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="row" style={{ gap: 12 }}>
          <div className="brand-mark" style={{ background: 'rgba(255,255,255,.16)' }}>
            <Plus size={20} strokeWidth={3} />
          </div>
          <div>
            <div className="brand-name">Sowaka Care</div>
            <div className="brand-sub" style={{ color: 'rgba(255,255,255,.7)' }}>Hospital Operations CRM</div>
          </div>
        </div>
        <div>
          <h1>Patients, doctors and the front desk — in one place.</h1>
          <ul>
            <li><UsersRound size={18} /> Register a patient in under a minute</li>
            <li><Stethoscope size={18} /> Doctors see their queue and full patient history</li>
            <li><Activity size={18} /> Owners see what's happening right now</li>
            <li><ShieldCheck size={18} /> Role-based access to medical records</li>
          </ul>
        </div>
        <div className="small" style={{ opacity: 0.7 }}>© {new Date().getFullYear()} Sowaka Care</div>
      </div>

      <div className="login-form">
        <div className="login-card">
          <h1 style={{ fontSize: 24 }}>Sign in</h1>
          <p className="muted" style={{ margin: '6px 0 22px' }}>Use the username and password given by your administrator.</p>
          <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
            <ErrorBox message={error} />
            <div className="field">
              <label htmlFor="u">Username</label>
              <input id="u" className="input lg" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="p">Password</label>
              <input id="p" className="input lg" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn primary lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <div className="demo-accounts">
            <div className="small muted strong">DEMO ACCOUNTS</div>
            {DEMO.map((d) => (
              <button key={d.username} type="button" disabled={busy} onClick={() => submit(undefined, d)}>
                <span>{d.label}</span>
                <span className="code">{d.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
