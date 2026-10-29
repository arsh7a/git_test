import type { ReactNode } from 'react'
import { dataset } from '../data'

// Small reusable building blocks.

export function Panel({ title, actions, children, className = '', flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && <h2 className="panel-title">{title}</h2>}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </section>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SeasonSelect({ value, seasons, onChange }: { value: string; seasons: string[]; onChange: (s: string) => void }) {
  return (
    <label className="select-wrap">
      <span className="select-label">Season</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {[...seasons].reverse().map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </label>
  )
}

export function SampleBadge() {
  if (!dataset.isSample) return null
  return (
    <span className="sample-badge" title="All players, clubs and statistics on this site are fictional sample data.">
      Sample data
    </span>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value num">{value}</div>
      {sub != null && <div className="tile-sub">{sub}</div>}
    </div>
  )
}
