import type { Doctor } from '../types'
import { VISIT_TYPES, money, nextSlot, todayISO, useFetch } from '../utils'
import { METHODS } from './PaymentModal'
import { Avatar, Segmented } from './ui'

export interface VisitForm {
  doctor_id: number | null
  appointment_date: string
  appointment_time: string
  visit_type: string
  reason: string
  mark_arrived: boolean
}

export interface PayForm {
  fee: string
  amount: string
  method: string
}

export const emptyVisit = (): VisitForm => ({
  doctor_id: null,
  appointment_date: todayISO(),
  appointment_time: nextSlot(),
  visit_type: 'consultation',
  reason: '',
  mark_arrived: true,
})

export const emptyPay = (): PayForm => ({ fee: '', amount: '', method: 'upi' })

export function useDoctors() {
  return useFetch<Doctor[]>('/api/doctors').data ?? []
}

export function VisitFields({ value, onChange, doctors }: { value: VisitForm; onChange: (v: VisitForm) => void; doctors: Doctor[] }) {
  const set = (patch: Partial<VisitForm>) => onChange({ ...value, ...patch })
  const isToday = value.appointment_date === todayISO()
  return (
    <div className="stack">
      <div className="field">
        <label className="req">Doctor</label>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {doctors.map((d) => {
            const on = value.doctor_id === d.id
            return (
              <button
                type="button"
                key={d.id}
                onClick={() => set({ doctor_id: d.id })}
                className="card"
                style={{
                  display: 'flex', gap: 10, alignItems: 'center', padding: 12, cursor: 'pointer', textAlign: 'left',
                  borderColor: on ? 'var(--brand)' : undefined, boxShadow: on ? '0 0 0 3px rgba(15,118,110,.14)' : undefined,
                  background: on ? 'var(--brand-soft)' : undefined,
                }}
              >
                <Avatar name={d.name} doc />
                <div style={{ minWidth: 0 }}>
                  <div className="strong">{d.name}</div>
                  <div className="small muted">{d.specialization}</div>
                  <div className="small muted">
                    {money(d.consultation_fee)}{d.today && ` · ${d.today.pending} in queue`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="form-grid cols-3">
        <div className="field">
          <label className="req">Date</label>
          <input className="input" type="date" value={value.appointment_date} min={todayISO()} onChange={(e) => set({ appointment_date: e.target.value })} />
        </div>
        <div className="field">
          <label className="req">Time</label>
          <input className="input" type="time" step={300} value={value.appointment_time} onChange={(e) => set({ appointment_time: e.target.value })} />
        </div>
        <div className="field">
          <label>Visit type</label>
          <select className="select" value={value.visit_type} onChange={(e) => set({ visit_type: e.target.value })}>
            {VISIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Reason for visit</label>
          <input className="input" placeholder="e.g. Fever, BP check, report review" value={value.reason} onChange={(e) => set({ reason: e.target.value })} />
        </div>
      </div>
      {isToday && (
        <label className="check">
          <input type="checkbox" checked={value.mark_arrived} onChange={(e) => set({ mark_arrived: e.target.checked })} />
          Patient is at the hospital now — add straight to the doctor's waiting queue
        </label>
      )}
    </div>
  )
}

export function PaymentFields({ value, onChange }: { value: PayForm; onChange: (v: PayForm) => void }) {
  const set = (patch: Partial<PayForm>) => onChange({ ...value, ...patch })
  const fee = Number(value.fee) || 0
  const paid = Number(value.amount) || 0
  const status = fee <= 0 || paid >= fee ? 'paid' : paid > 0 ? 'partial' : 'pending'
  return (
    <div className="stack">
      <div className="form-grid">
        <div className="field">
          <label>Consultation fee (₹)</label>
          <input className="input" type="number" min={0} value={value.fee} onChange={(e) => set({ fee: e.target.value })} />
        </div>
        <div className="field">
          <label>Amount paid now (₹)</label>
          <input className="input" type="number" min={0} value={value.amount} onChange={(e) => set({ amount: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Payment mode</label>
        <Segmented options={METHODS} value={value.method} onChange={(m) => set({ method: m })} />
      </div>
      <div className="row">
        <span className="label">Payment status:</span>
        <span className={`badge plain b-${status}`}>{{ paid: 'Paid', partial: `Partial — ${money(fee - paid)} due`, pending: 'Unpaid' }[status]}</span>
        <span className="small muted">(set automatically)</span>
      </div>
    </div>
  )
}

export function visitPayload(v: VisitForm, p: PayForm) {
  return {
    doctor_id: v.doctor_id,
    appointment_date: v.appointment_date,
    appointment_time: v.appointment_time,
    visit_type: v.visit_type,
    reason: v.reason || null,
    fee: p.fee === '' ? null : Number(p.fee),
    mark_arrived: v.appointment_date === todayISO() && v.mark_arrived,
  }
}

export function paymentPayload(p: PayForm) {
  const amount = Number(p.amount) || 0
  return amount > 0 ? { amount, payment_method: p.method } : null
}
