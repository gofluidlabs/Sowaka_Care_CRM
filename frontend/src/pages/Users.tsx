import { Copy, KeyRound, Pencil, Power, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Avatar, ErrorBox, Loading, Modal, Segmented, useToast } from '../components/ui'
import type { Role, User } from '../types'
import { relativeTime, useFetch } from '../utils'

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner / Admin', doctor: 'Doctor', front_desk: 'Front Desk' }
const DESIGNATIONS = ['Front Desk', 'Receptionist', 'Nurse', 'Other Staff']

interface Credentials { user: User; temporary_password: string; title: string }

export default function Users() {
  const { user: me } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data, error, reload } = useFetch<User[]>('/api/users')
  const [filter, setFilter] = useState<'all' | Role>('all')
  const [creating, setCreating] = useState<Role | null>(null)
  const [editing, setEditing] = useState<User | null>(null)
  const [confirm, setConfirm] = useState<{ user: User; kind: 'reset' | 'toggle' } | null>(null)
  const [creds, setCreds] = useState<Credentials | null>(null)
  const toast = useToast()

  useEffect(() => {
    const r = params.get('new') as Role | null
    if (r && r in ROLE_LABEL) {
      setCreating(r)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const list = data.filter((u) => filter === 'all' || u.role === filter)

  const runConfirm = async () => {
    if (!confirm) return
    const { user, kind } = confirm
    setConfirm(null)
    try {
      if (kind === 'reset') {
        const res = await api.post<{ user: User; temporary_password: string }>(`/api/users/${user.id}/reset-password`)
        setCreds({ ...res, title: 'Password reset' })
      } else {
        const status = user.status === 'active' ? 'inactive' : 'active'
        await api.patch(`/api/users/${user.id}`, { status })
        toast(`${user.name} ${status === 'active' ? 'activated' : 'deactivated'}`)
      }
      reload()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>User & access management</h1>
          <p>Create logins, assign roles, reset passwords and disable accounts.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setCreating('front_desk')}><UserPlus /> Front desk / staff</button>
          <button className="btn primary" onClick={() => setCreating('doctor')}><UserPlus /> Doctor</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented<'all' | Role>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${data.length})` },
            { value: 'doctor', label: 'Doctors' },
            { value: 'front_desk', label: 'Front desk & staff' },
            { value: 'owner', label: 'Owners' },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Username</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={u.name} doc={u.role === 'doctor'} />
                      <div>
                        <div className="strong">{u.name}</div>
                        <div className="small muted">{u.doctor ? `${u.doctor.code} · ${u.doctor.specialization ?? ''}` : u.email || u.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="code">{u.username}</td>
                  <td>
                    <span className="badge plain b-brand">{ROLE_LABEL[u.role]}</span>
                    {u.role === 'front_desk' && u.designation && u.designation !== 'Front Desk' && <span className="small muted"> · {u.designation}</span>}
                  </td>
                  <td>
                    <span className={`badge b-${u.status}`}>{u.status === 'active' ? 'Active' : 'Inactive'}</span>
                    {u.must_change_password && u.status === 'active' && <div className="small muted">Temp password</div>}
                  </td>
                  <td className="muted">{relativeTime(u.last_login)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                      <button className="btn sm ghost" onClick={() => setEditing(u)} title="Edit"><Pencil /></button>
                      <button className="btn sm ghost" onClick={() => setConfirm({ user: u, kind: 'reset' })} title="Reset password"><KeyRound /></button>
                      {u.id !== me?.id && (
                        <button className={`btn sm ghost${u.status === 'active' ? ' danger' : ''}`} onClick={() => setConfirm({ user: u, kind: 'toggle' })}
                          title={u.status === 'active' ? 'Deactivate' : 'Activate'}>
                          <Power />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <UserForm
          role={creating}
          onClose={() => setCreating(null)}
          onCreated={(c) => { setCreating(null); setCreds(c); reload() }}
        />
      )}
      {editing && <UserForm existing={editing} role={editing.role} onClose={() => setEditing(null)} onCreated={() => { setEditing(null); reload() }} />}
      {confirm && (
        <Modal
          title={confirm.kind === 'reset' ? 'Reset password?' : confirm.user.status === 'active' ? 'Deactivate account?' : 'Activate account?'}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`btn ${confirm.kind === 'toggle' && confirm.user.status === 'active' ? 'danger' : 'primary'}`} onClick={runConfirm}>
                {confirm.kind === 'reset' ? 'Reset password' : confirm.user.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </>
          }
        >
          {confirm.kind === 'reset'
            ? <p style={{ margin: 0 }}>A new temporary password will be generated for <strong>{confirm.user.name}</strong>. They'll be asked to change it on next login.</p>
            : confirm.user.status === 'active'
              ? <p style={{ margin: 0 }}><strong>{confirm.user.name}</strong> will be signed out and won't be able to log in. Their records and history are kept.</p>
              : <p style={{ margin: 0 }}><strong>{confirm.user.name}</strong> will be able to log in again.</p>}
        </Modal>
      )}
      {creds && <CredentialsModal c={creds} onClose={() => setCreds(null)} />}
    </div>
  )
}

function UserForm({ role: initialRole, existing, onClose, onCreated }: {
  role: Role
  existing?: User
  onClose: () => void
  onCreated: (c: Credentials) => void
}) {
  const toast = useToast()
  const [role, setRole] = useState<Role>(initialRole)
  const [f, setF] = useState({
    name: existing?.name ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    username: existing?.username ?? '',
    password: '',
    designation: existing?.designation ?? (initialRole === 'front_desk' ? 'Front Desk' : ''),
    specialization: existing?.doctor?.specialization ?? '',
    department: existing?.doctor?.department ?? '',
    consultation_fee: existing?.doctor ? String(existing.doctor.consultation_fee) : '500',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    setBusy(true)
    setError(null)
    const common = {
      name: f.name, email: f.email || null, phone: f.phone || null, role,
      designation: role === 'front_desk' ? f.designation : role === 'doctor' ? 'Doctor' : 'Owner / Admin',
      ...(role === 'doctor' ? { specialization: f.specialization || null, department: f.department || null, consultation_fee: Number(f.consultation_fee) || 0 } : {}),
    }
    try {
      if (existing) {
        await api.patch(`/api/users/${existing.id}`, common)
        toast('Account updated')
        onCreated({ user: existing, temporary_password: '', title: '' })
      } else {
        const res = await api.post<{ user: User; temporary_password: string }>('/api/users', {
          ...common, username: f.username || null, password: f.password || null,
        })
        onCreated({ ...res, title: 'Account created' })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={existing ? `Edit ${existing.name}` : role === 'doctor' ? 'Create doctor account' : role === 'owner' ? 'Create owner account' : 'Create staff account'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={busy || f.name.trim().length < 2}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Create account'}
          </button>
        </>
      }
    >
      <div className="stack">
        <ErrorBox message={error} />
        <div className="field">
          <label>Role</label>
          <Segmented<Role> value={role} onChange={setRole} options={[
            { value: 'doctor', label: 'Doctor' },
            { value: 'front_desk', label: 'Front Desk / Staff' },
            { value: 'owner', label: 'Owner / Admin' },
          ]} />
        </div>
        <div className="form-grid">
          <div className="field span-2"><label className="req">Full name</label><input className="input" value={f.name} onChange={set('name')} autoFocus placeholder={role === 'doctor' ? 'Dr. Full Name' : ''} /></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
          <div className="field"><label>Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
          {role === 'doctor' && (
            <>
              <div className="field"><label>Specialization</label><input className="input" value={f.specialization} onChange={set('specialization')} placeholder="e.g. General Physician" /></div>
              <div className="field"><label>Department</label><input className="input" value={f.department} onChange={set('department')} placeholder="e.g. General Medicine" /></div>
              <div className="field"><label>Consultation fee (₹)</label><input className="input" type="number" min={0} value={f.consultation_fee} onChange={set('consultation_fee')} /></div>
            </>
          )}
          {role === 'front_desk' && (
            <div className="field">
              <label>Designation</label>
              <select className="select" value={f.designation} onChange={set('designation')}>
                {DESIGNATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>
        {!existing && (
          <>
            <div className="divider" style={{ margin: 0 }} />
            <div className="form-grid">
              <div className="field">
                <label>Username</label>
                <input className="input" value={f.username} onChange={set('username')} placeholder="Auto: firstname.lastname" />
              </div>
              <div className="field">
                <label>Temporary password</label>
                <input className="input" value={f.password} onChange={set('password')} placeholder="Auto-generated if blank" />
                <span className="hint">User must change it at first login</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function CredentialsModal({ c, onClose }: { c: Credentials; onClose: () => void }) {
  const toast = useToast()
  const text = `Sowaka Care CRM login\nUsername: ${c.user.username}\nTemporary password: ${c.temporary_password}\n${location.origin}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Login details copied')
    } catch {
      toast('Copy failed — please note the details manually')
    }
  }
  return (
    <Modal title={c.title} onClose={onClose} footer={
      <>
        <button className="btn" onClick={copy}><Copy /> Copy login details</button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </>
    }>
      <div className="stack" style={{ gap: 12 }}>
        <div className="alert warn">Share these details with {c.user.name}. The temporary password will not be shown again.</div>
        <dl className="kv" style={{ margin: 0 }}>
          <dt>Name</dt><dd>{c.user.name}</dd>
          {c.user.doctor && <><dt>Doctor ID</dt><dd>{c.user.doctor.code}</dd></>}
          <dt>Role</dt><dd>{ROLE_LABEL[c.user.role]}</dd>
          <dt>Username</dt><dd className="code" style={{ fontSize: 14, color: 'var(--ink)' }}>{c.user.username}</dd>
        </dl>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Temporary password</div>
          <div className="secret">{c.temporary_password}</div>
        </div>
      </div>
    </Modal>
  )
}
