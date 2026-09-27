import { useRef, useState } from 'react'

interface Point {
  label: string
  value: number
  tip?: string
}

/** Single-series line/area chart with hover tooltip. */
export function LineChart({ data, height = 200, color = 'var(--brand)', format = String }: {
  data: Point[]
  height?: number
  color?: string
  format?: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const W = 600
  const H = height
  const pad = { l: 36, r: 12, t: 12, b: 26 }
  const max = Math.max(1, ...data.map((d) => d.value))
  const nice = niceMax(max)
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (data.length - 1))
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const ticks = [0, nice / 2, nice]
  const labelEvery = Math.ceil(data.length / 8)

  const onMove = (e: React.MouseEvent) => {
    const svg = ref.current
    if (!svg || !data.length) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart-svg" viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line-2)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        <path d={area} fill={color} opacity={0.08} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{d.label}</text>
          ) : null,
        )}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line)" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <strong>{format(data[hover].value)}</strong> · {data[hover].tip ?? data[hover].label}
        </div>
      )}
    </div>
  )
}

/** Vertical columns — used for peak hours. */
export function ColumnChart({ data, height = 180, color = 'var(--brand)', highlightMax = true }: {
  data: Point[]
  height?: number
  color?: string
  highlightMax?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = height
  const pad = { l: 8, r: 8, t: 18, b: 24 }
  const max = Math.max(1, ...data.map((d) => d.value))
  const slot = (W - pad.l - pad.r) / data.length
  const bw = Math.min(34, slot * 0.64)
  const peak = data.findIndex((d) => d.value === max)
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" onMouseLeave={() => setHover(null)}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
      {data.map((d, i) => {
        const h = (d.value / max) * (H - pad.t - pad.b)
        const cx = pad.l + slot * i + slot / 2
        const isPeak = highlightMax && i === peak
        return (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={cx - slot / 2} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
            <rect x={cx - bw / 2} y={H - pad.b - h} width={bw} height={Math.max(h, 1)} rx={4}
              fill={color} opacity={isPeak || hover === i ? 1 : 0.45} />
            {(hover === i || isPeak) && (
              <text x={cx} y={H - pad.b - h - 5} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 600 }}>{d.value}</text>
            )}
            <text x={cx} y={H - 7} textAnchor="middle">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Horizontal bars with labels, e.g. doctor workload. */
export function BarList({ data, format = String, color }: { data: Point[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bar-list">
      {data.map((d) => (
        <div className="bar-row" key={d.label} title={d.tip}>
          <span className="lbl">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="val">{format(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return n * exp
}
