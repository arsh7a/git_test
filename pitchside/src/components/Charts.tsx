import { useState } from 'react'
import { METRIC } from '../data/metrics'
import type { Position } from '../data/types'
import { formatMetric, ordinal } from '../lib/format'

// ---------------------------------------------------------------------------
// Position map: a pitch showing natural (filled) and secondary (ringed) roles.
// ---------------------------------------------------------------------------

const POS_XY: Record<Position, [number, number]> = {
  'ST (C)': [50, 12],
  'AM (L)': [17, 28],
  'AM (C)': [50, 30],
  'AM (R)': [83, 28],
  'M (L)': [14, 48],
  'M (C)': [50, 49],
  'M (R)': [86, 48],
  'WB (L)': [12, 64],
  DM: [50, 65],
  'WB (R)': [88, 64],
  'D (L)': [15, 80],
  'D (C)': [50, 82],
  'D (R)': [85, 80],
  GK: [50, 95],
}

export function PositionMap({ primary, secondary }: { primary: Position; secondary: Position[] }) {
  return (
    <div className="posmap">
      <svg viewBox="0 0 100 104" className="pitch" role="img" aria-label={`Positions: ${[primary, ...secondary].join(', ')}`}>
        <rect x="1" y="1" width="98" height="102" rx="2" className="pitch-bg" />
        <g className="pitch-lines">
          <rect x="1" y="1" width="98" height="102" rx="2" fill="none" />
          <line x1="1" y1="52" x2="99" y2="52" />
          <circle cx="50" cy="52" r="10" fill="none" />
          <rect x="25" y="1" width="50" height="16" fill="none" />
          <rect x="38" y="1" width="24" height="6" fill="none" />
          <rect x="25" y="87" width="50" height="16" fill="none" />
          <rect x="38" y="97" width="24" height="6" fill="none" />
        </g>
        {(Object.keys(POS_XY) as Position[]).map((p) => {
          const [x, y] = POS_XY[p]
          const isPrimary = p === primary
          const isSecondary = secondary.includes(p)
          return (
            <g key={p}>
              <title>{`${p}${isPrimary ? ' — Natural' : isSecondary ? ' — Accomplished' : ''}`}</title>
              <circle
                cx={x}
                cy={y}
                r={isPrimary || isSecondary ? 5 : 2}
                className={isPrimary ? 'pos-primary' : isSecondary ? 'pos-secondary' : 'pos-empty'}
              />
            </g>
          )
        })}
      </svg>
      <div className="posmap-legend">
        <span><i className="dot dot-primary" /> Natural · {primary}</span>
        {secondary.length > 0 && (
          <span><i className="dot dot-secondary" /> Accomplished · {secondary.join(', ')}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Percentile bar: one stat, its per-90 value and percentile rank.
// ---------------------------------------------------------------------------

export function PercentileBar({ metricId, value, pct, peerLabel }: { metricId: string; value: number | null; pct: number | null; peerLabel: string }) {
  const m = METRIC[metricId]
  const tip =
    pct == null
      ? `${m.label}: not enough volume to rank`
      : `${m.label}: ${formatMetric(m, value, true)}${m.per90 ? ' per 90' : ''} — better than ${pct}% of ${peerLabel.toLowerCase()}${m.lowerIsBetter ? ' (lower is better)' : ''}`
  return (
    <div className="pbar" data-tip={tip} tabIndex={0}>
      <span className="pbar-label" title={m.description}>{m.label}</span>
      <span className="pbar-value num">{formatMetric(m, value, true)}</span>
      <span className="pbar-track">
        <span className="pbar-mid" />
        {pct != null && <span className={`pbar-fill tone-${pct >= 90 ? 'elite' : pct >= 70 ? 'good' : pct >= 30 ? 'avg' : 'low'}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />}
      </span>
      <span className="pbar-pct num">{pct == null ? '—' : pct}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Radar chart: percentile profile across ~10 stats, for one or two players.
// ---------------------------------------------------------------------------

export interface RadarSeries {
  name: string
  colorVar: string // CSS variable, e.g. "--series-a"
  values: (number | null)[] // percentiles
  raw: (number | null)[]
}

export function RadarChart({ metrics, series, size = 340 }: { metrics: string[]; series: RadarSeries[]; size?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const pad = 64
  const r = (size - pad * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const n = metrics.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, v: number) => [cx + Math.cos(angle(i)) * r * (v / 100), cy + Math.sin(angle(i)) * r * (v / 100)]

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="Percentile radar chart">
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            className={ring === 50 ? 'radar-ring radar-ring-mid' : 'radar-ring'}
            points={metrics.map((_, i) => point(i, ring).join(',')).join(' ')}
          />
        ))}
        {metrics.map((_, i) => {
          const [x, y] = point(i, 100)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className={hover === i ? 'radar-spoke active' : 'radar-spoke'} />
        })}
        {series.map((s) => (
          <polygon
            key={s.name}
            points={s.values.map((v, i) => point(i, v ?? 0).join(',')).join(' ')}
            style={{ fill: `var(${s.colorVar})`, stroke: `var(${s.colorVar})` }}
            className="radar-area"
          />
        ))}
        {series.map((s) =>
          s.values.map((v, i) => {
            const [x, y] = point(i, v ?? 0)
            return <circle key={`${s.name}-${i}`} cx={x} cy={y} r={hover === i ? 4.5 : 3.2} className="radar-dot" style={{ fill: `var(${s.colorVar})` }} />
          }),
        )}
        {metrics.map((id, i) => {
          const [x, y] = point(i, 100)
          const a = angle(i)
          const lx = cx + Math.cos(a) * (r + 12)
          const ly = cy + Math.sin(a) * (r + 12)
          const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
          const dy = Math.sin(a) > 0.6 ? 10 : Math.sin(a) < -0.6 ? -4 : 4
          // generous invisible hit target for each axis
          return (
            <g key={id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="radar-axis">
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="transparent" strokeWidth={22} />
              <text x={lx} y={ly + dy} textAnchor={anchor} className={hover === i ? 'radar-label active' : 'radar-label'}>
                {METRIC[id].short}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="radar-readout" aria-live="polite">
        {hover == null ? (
          <span className="muted">Hover an axis for details · rings at 25th, 50th, 75th percentile</span>
        ) : (
          <>
            <strong>{METRIC[metrics[hover]].label}</strong>
            {series.map((s) => (
              <span key={s.name} className="radar-readout-item">
                <i className="swatch" style={{ background: `var(${s.colorVar})` }} />
                {s.name}: {formatMetric(METRIC[metrics[hover]], s.raw[hover], true)}
                {METRIC[metrics[hover]].per90 ? '/90' : ''} · {s.values[hover] == null ? 'n/a' : `${ordinal(s.values[hover]!)} pct`}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simple vertical bar chart (one series) for season-by-season trends.
// ---------------------------------------------------------------------------

export function SeasonBars({ title, items, format }: { title: string; items: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001)
  return (
    <div className="sbars">
      <div className="sbars-title">{title}</div>
      <div className="sbars-plot">
        {items.map((it) => (
          <div key={it.label} className="sbars-col" data-tip={`${it.label}: ${format(it.value)}`} tabIndex={0}>
            <span className="sbars-val num">{format(it.value)}</span>
            <span className="sbars-bar" style={{ height: `${(it.value / max) * 100}%` }} />
            <span className="sbars-label">{it.label.replace(/^20/, '')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
