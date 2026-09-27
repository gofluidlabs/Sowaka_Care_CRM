import type { Visit } from '../types'
import { fmtDate, visitTypeLabel } from '../utils'

export default function VisitCard({ v }: { v: Visit }) {
  return (
    <div className="visit-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="strong">{v.diagnosis || 'No diagnosis recorded'}</div>
          <div className="small muted">
            {fmtDate(v.created_at)} · {visitTypeLabel(v.visit_type)} · {v.doctor_name}
          </div>
        </div>
        {v.follow_up_date && <span className="chip">Follow-up {fmtDate(v.follow_up_date, { day: 'numeric', month: 'short' })}</span>}
      </div>
      {v.vitals && <div className="small" style={{ marginTop: 6 }}><span className="muted">Vitals:</span> {v.vitals}</div>}
      {v.notes && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{v.notes}</div>}
      {v.prescriptions.length > 0 && (
        <table className="rx-table">
          <tbody>
            {v.prescriptions.map((rx, i) => (
              <tr key={rx.id ?? i}>
                <td className="strong">℞ {rx.medicine}</td>
                <td>{rx.dosage}</td>
                <td>{rx.duration}</td>
                <td className="muted">{rx.instructions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
