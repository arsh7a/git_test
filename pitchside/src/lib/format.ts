import type { Metric } from '../data/metrics'

/** Formats a statistic for display. Per-90 values get two decimals. */
export function formatMetric(m: Metric, v: number | null | undefined, per90 = false): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (m.format === 'pct') return `${(v * 100).toFixed(1)}%`
  if (per90 && m.per90) return v.toFixed(2)
  if (m.format === 'dec2') return v.toFixed(2)
  if (m.format === 'dec1') return (Math.round(v * 10) / 10).toFixed(1)
  return Math.round(v).toLocaleString('en-GB')
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function percentileTier(p: number | null): { label: string; tone: 'elite' | 'good' | 'avg' | 'low' | 'none' } {
  if (p == null) return { label: 'Not enough data', tone: 'none' }
  if (p >= 90) return { label: 'Elite', tone: 'elite' }
  if (p >= 70) return { label: 'Above average', tone: 'good' }
  if (p >= 30) return { label: 'Average', tone: 'avg' }
  return { label: 'Below average', tone: 'low' }
}
