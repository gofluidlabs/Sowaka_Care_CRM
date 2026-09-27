import { useState } from 'react'
import { api } from '../api'
import type { Appointment } from '../types'
import { fmt12, fmtDate, money } from '../utils'
import { ErrorBox, Modal, Segmented, useToast } from './ui'

export const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

export default function PaymentModal({ appt, onClose, onDone }: { appt: Appointment; onClose: () => void; onDone: () => void }) {
  const due = Math.max(0, appt.fee - appt.amount_paid)
  const [amount, setAmount] = useState(String(due))
  const [method, setMethod] = useState('upi')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/payments', { appointment_id: appt.id, amount: Number(amount), payment_method: method })
      toast(`${money(Number(amount))} recorded for ${appt.patient_name}`)
      onDone()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={busy || !(Number(amount) > 0)}>
            {busy ? 'Saving…' : `Record ${money(Number(amount) || 0)}`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <ErrorBox message={error} />
        <div className="card-body" style={{ background: 'var(--surface-2)', borderRadius: 10 }}>
          <div className="strong">{appt.patient_name} <span className="code">{appt.patient_code}</span></div>
          <div className="small muted">
            {appt.doctor_name} · {fmtDate(appt.appointment_date, { day: 'numeric', month: 'short' })} {fmt12(appt.appointment_time)}
          </div>
          <div className="row mt" style={{ gap: 20 }}>
            <div><div className="small muted">Fee</div><div className="strong">{money(appt.fee)}</div></div>
            <div><div className="small muted">Paid</div><div className="strong">{money(appt.amount_paid)}</div></div>
            <div><div className="small muted">Due</div><div className="strong" style={{ color: 'var(--amber)' }}>{money(due)}</div></div>
          </div>
        </div>
        <div className="field">
          <label>Amount received (₹)</label>
          <input className="input lg" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Payment mode</label>
          <Segmented options={METHODS} value={method} onChange={setMethod} />
        </div>
      </div>
    </Modal>
  )
}
