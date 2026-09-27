import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { AppointmentStatus } from './types'

/** Fetch JSON from the API; optionally re-poll every `pollMs` so dashboards stay live. */
export function useFetch<T>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!path)
  const pathRef = useRef(path)
  pathRef.current = path

  const load = useCallback(async (quiet = false) => {
    const p = pathRef.current
    if (!p) return
    if (!quiet) setLoading(true)
    try {
      const res = await api.get<T>(p)
      if (pathRef.current === p) {
        setData(res)
        setError(null)
      }
    } catch (e) {
      if (pathRef.current === p) setError((e as Error).message)
    } finally {
      if (pathRef.current === p) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    if (!pollMs) return
    const id = setInterval(() => load(true), pollMs)
    return () => clearInterval(id)
  }, [path, pollMs, load])

  return { data, error, loading, reload: () => load(true), setData }
}

export const todayISO = () => toISODate(new Date())

export function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function nextSlot(): string {
  const d = new Date()
  let h = d.getHours()
  let m = d.getMinutes() < 30 ? 30 : 0
  if (m === 0) h += 1
  if (h > 20) return '09:00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const money = (n: number) => inr.format(n || 0)
export const compactMoney = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 1 : 2)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : money(n)

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('en-IN', opts)
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function fmt12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `Today, ${fmtTime(iso)}`
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${fmtTime(iso)}`
  return `${fmtDate(iso, { day: 'numeric', month: 'short' })}, ${fmtTime(iso)}`
}

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  waiting: 'Waiting',
  with_doctor: 'With Doctor',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export const VISIT_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'check_up', label: 'Check-up' },
  { value: 'emergency', label: 'Emergency' },
]

export const visitTypeLabel = (v: string) => VISIT_TYPES.find((t) => t.value === v)?.label ?? v.replace('_', ' ')

export const firstName = (name: string) => {
  const parts = name.replace(/^Dr\.?\s+/i, '').split(' ')
  return name.startsWith('Dr') ? `Dr. ${parts[0]}` : parts[0]
}

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
