import { AlertCircle, CheckCircle2, Inbox, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppointmentStatus } from '../types'
import { STATUS_LABEL, initials } from '../utils'

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge b-${status}`}>{STATUS_LABEL[status]}</span>
}

export function PayBadge({ status }: { status: 'paid' | 'partial' | 'pending' }) {
  const label = { paid: 'Paid', partial: 'Partial', pending: 'Unpaid' }[status]
  return <span className={`badge plain b-${status}`}>{label}</span>
}

export function Stat({
  label, value, hint, icon, hero, dot,
}: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; hero?: boolean; dot?: string }) {
  return (
    <div className={`stat${hero ? ' hero' : ''}`}>
      <div className="stat-label">
        {dot && <span className="dot" style={{ background: dot }} />}
        {icon}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function Avatar({ name, doc, lg }: { name: string; doc?: boolean; lg?: boolean }) {
  return <div className={`avatar${doc ? ' doc' : ''}${lg ? ' lg' : ''}`}>{initials(name)}</div>
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <div>{children}</div>
    </div>
  )
}

export function Loading() {
  return (
    <div className="loading">
      <span className="spinner" />
    </div>
  )
}

export function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <div className="alert error">
      <AlertCircle />
      <span>{message}</span>
    </div>
  )
}

export function Modal({
  title, onClose, children, footer, wide,
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

const ToastContext = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const show = useCallback((m: string) => setMsg(m), [])
  useEffect(() => {
    if (!msg) return
    const id = setTimeout(() => setMsg(null), 3200)
    return () => clearTimeout(id)
  }, [msg])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <CheckCircle2 />
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string | number>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
