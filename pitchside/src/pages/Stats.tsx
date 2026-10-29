import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { ClubBadge, Flag } from '../components/Identity'
import { Panel, Segmented } from '../components/UI'
import { dataset, getSeasonRows, hasAges, type SeasonRow } from '../data'
import { GROUP_LABEL, METRIC, TABLE_VIEWS, metricValue } from '../data/metrics'
import type { PositionGroup } from '../data/types'
import { formatMetric } from '../lib/format'

const GROUPS: PositionGroup[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST']
const MIN_OPTIONS = [0, 450, 900, 1350, 1800, 2700]

// Every filter lives in the web address, so a filtered table can be bookmarked or shared.
const DEFAULTS: Record<string, string> = {
  view: 'standard',
  season: dataset.currentSeason,
  per90: '',
  q: '',
  league: '',
  club: '',
  pos: '',
  ageMin: '',
  ageMax: '',
  minMins: '0',
  metric: '',
  metricMin: '',
  sort: '',
  dir: 'desc',
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Stats() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const get = (k: string) => params.get(k) ?? DEFAULTS[k]
  const set = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(values)) {
      if (v === DEFAULTS[k] || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const view = TABLE_VIEWS.find((v) => v.id === get('view')) ?? TABLE_VIEWS[0]
  const season = dataset.seasons.includes(get('season')) ? get('season') : dataset.currentSeason
  const per90 = get('per90') === '1'
  const q = get('q')
  const league = get('league')
  const club = get('club')
  const positions = get('pos') ? (get('pos').split(',') as PositionGroup[]) : []
  const ageMin = get('ageMin') ? Number(get('ageMin')) : null
  const ageMax = get('ageMax') ? Number(get('ageMax')) : null
  const minMins = Number(get('minMins')) || 0
  const metricFilter = get('metric') && METRIC[get('metric')] ? METRIC[get('metric')] : null
  const metricMin = get('metricMin') !== '' ? Number(get('metricMin')) : null
  const sortKey = get('sort') || view.metrics.find((id) => id !== 'mins' && id !== 'apps') || view.metrics[0]
  const sort = { key: sortKey, dir: get('dir') as 'asc' | 'desc' }

  const clubOptions = dataset.clubs.filter((c) => !league || c.leagueId === league)

  const rows = useMemo(() => {
    const nq = normalize(q.trim())
    return getSeasonRows(season).filter((r) => {
      if (view.gkOnly ? r.player.group !== 'GK' : view.id !== 'standard' && r.player.group === 'GK') return false
      if (nq && !normalize(r.player.name).includes(nq)) return false
      if (league && r.league.id !== league) return false
      if (club && r.club.id !== club) return false
      if (positions.length && !positions.includes(r.player.group)) return false
      if (ageMin != null && (r.age == null || r.age < ageMin)) return false
      if (ageMax != null && (r.age == null || r.age > ageMax)) return false
      if (r.stats.mins < minMins) return false
      if (metricFilter && metricMin != null) {
        const v = metricValue(metricFilter, r.stats, per90 && metricFilter.per90)
        const shown = v == null ? null : metricFilter.format === 'pct' ? v * 100 : v
        if (shown == null || shown < metricMin) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, view.id, q, league, club, get('pos'), ageMin, ageMax, minMins, metricFilter, metricMin, per90])

  const columns: Column<SeasonRow>[] = [
    { key: 'rk', label: 'Rk', align: 'right', className: 'rk', render: (_, i) => <span className="muted">{i + 1}</span> },
    {
      key: 'player',
      label: 'Player',
      align: 'left',
      sticky: true,
      sortValue: (r) => r.player.lastName,
      render: (r) => <Link to={`/players/${r.player.id}?season=${season}`} onClick={(e) => e.stopPropagation()} className="cell-player">{r.player.name}</Link>,
    },
    { key: 'nation', label: 'Nation', align: 'left', sortValue: (r) => r.player.nationCode, render: (r) => <span className="cell-nation"><Flag code={r.player.nationCode} size={10} /> {r.player.nationCode}</span> },
    { key: 'pos', label: 'Pos', title: 'Position', align: 'left', sortValue: (r) => GROUPS.indexOf(r.player.group), render: (r) => <span className="pos-badge" title={GROUP_LABEL[r.player.group]}>{r.player.group}</span> },
    { key: 'club', label: 'Club', align: 'left', sortValue: (r) => r.club.name, render: (r) => <span className="cell-club"><ClubBadge clubId={r.club.id} size={14} /> {r.club.shortName}</span> },
    { key: 'league', label: 'League', align: 'left', sortValue: (r) => r.league.name, render: (r) => <span className="muted">{r.league.name}</span> },
    ...(hasAges ? [{ key: 'age', label: 'Age', align: 'right', sortValue: (r) => r.age ?? 0, render: (r) => r.age } as Column<SeasonRow>] : []),
    ...view.metrics.map<Column<SeasonRow>>((id) => {
      const m = METRIC[id]
      const usePer90 = per90 && m.per90
      return {
        key: id,
        label: m.short,
        title: `${m.label}${usePer90 ? ' (per 90)' : ''} — ${m.description}`,
        align: 'right',
        sortValue: (r) => metricValue(m, r.stats, usePer90),
        render: (r) => <span className="num">{formatMetric(m, metricValue(m, r.stats, usePer90), usePer90)}</span>,
      }
    }),
  ]

  const togglePos = (g: PositionGroup) => {
    const next = positions.includes(g) ? positions.filter((p) => p !== g) : [...positions, g]
    set({ pos: next.join(',') })
  }

  const filterMetrics = view.metrics.filter((id) => !['apps', 'starts'].includes(id))
  const activeFilters = ['q', 'league', 'club', 'pos', 'ageMin', 'ageMax', 'metric', 'metricMin'].some((k) => params.get(k)) || minMins > (per90 ? 900 : 0)

  return (
    <div className="container page stats-page">
      <div className="page-head">
        <div>
          <h1>Statistics</h1>
          <p className="muted">Every player’s league numbers for a season. Click a column heading to sort; hover it for a definition.</p>
        </div>
      </div>

      <Panel className="filters">
        <div className="filter-row">
          <label className="field grow">
            <span>Player name</span>
            <input type="search" value={q} placeholder="Filter by name…" onChange={(e) => set({ q: e.target.value })} />
          </label>
          <label className="field">
            <span>Season</span>
            <select value={season} onChange={(e) => set({ season: e.target.value })}>
              {[...dataset.seasons].reverse().map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>League</span>
            <select value={league} onChange={(e) => set({ league: e.target.value, club: '' })}>
              <option value="">All leagues</option>
              {dataset.leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Club</span>
            <select value={club} onChange={(e) => set({ club: e.target.value })}>
              <option value="">All clubs</option>
              {clubOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {hasAges && <div className="field">
            <span>Age</span>
            <div className="range-inputs">
              <input type="number" min={15} max={45} placeholder="Min" value={ageMin ?? ''} onChange={(e) => set({ ageMin: e.target.value })} aria-label="Minimum age" />
              <span className="muted">–</span>
              <input type="number" min={15} max={45} placeholder="Max" value={ageMax ?? ''} onChange={(e) => set({ ageMax: e.target.value })} aria-label="Maximum age" />
            </div>
          </div>}
          <label className="field">
            <span>Minimum minutes</span>
            <select value={minMins} onChange={(e) => set({ minMins: e.target.value })}>
              {MIN_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? 'Any' : `${m}+ mins`}</option>)}
            </select>
          </label>
        </div>
        <div className="filter-row">
          <div className="field">
            <span>Position</span>
            <div className="chips" role="group" aria-label="Position">
              {GROUPS.map((g) => (
                <button key={g} type="button" title={GROUP_LABEL[g]} className={positions.includes(g) ? 'chip on' : 'chip'} aria-pressed={positions.includes(g)} onClick={() => togglePos(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Stat filter</span>
            <div className="range-inputs">
              <select value={metricFilter?.id ?? ''} onChange={(e) => set({ metric: e.target.value })} aria-label="Statistic to filter on">
                <option value="">Choose a stat…</option>
                {filterMetrics.map((id) => <option key={id} value={id}>{METRIC[id].label}</option>)}
              </select>
              <span className="muted">≥</span>
              <input
                type="number"
                step="any"
                placeholder={metricFilter?.format === 'pct' ? '%' : 'Value'}
                value={metricMin ?? ''}
                disabled={!metricFilter}
                onChange={(e) => set({ metricMin: e.target.value })}
                aria-label="Minimum value"
              />
            </div>
          </div>
          <div className="field field-end">
            <button type="button" className="btn btn-ghost" disabled={!activeFilters} onClick={() => {
                const keep = new URLSearchParams(Object.fromEntries([...params].filter(([k]) => ['view', 'season', 'per90'].includes(k))))
                if (per90) keep.set('minMins', '900')
                setParams(keep, { replace: true })
              }}>
              Reset filters
            </button>
          </div>
        </div>
      </Panel>

      <div className="table-toolbar">
        <div className="view-tabs" role="tablist" aria-label="Statistic group">
          {TABLE_VIEWS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === view.id} className={v.id === view.id ? 'vtab on' : 'vtab'} onClick={() => set({ view: v.id, sort: '', metric: '', metricMin: '' })}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="table-toolbar-right">
          <span className="muted small">{rows.length.toLocaleString('en-GB')} players</span>
          <Segmented
            label="Value type"
            value={per90 ? 'per90' : 'total'}
            onChange={(v) => set(v === 'per90' ? { per90: '1', minMins: minMins ? String(minMins) : '900' } : { per90: '' })}
            options={[{ value: 'total', label: 'Totals' }, { value: 'per90', label: 'Per 90' }]}
          />
        </div>
      </div>
      {per90 && minMins < 450 && <p className="note">Per-90 numbers can be misleading for players with very few minutes. Consider raising the minimum minutes.</p>}

      <Panel flush className="stats-table-panel">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.player.id}
          sort={sort}
          onSortChange={(s) => set({ sort: s.key, dir: s.dir })}
          onRowClick={(r) => navigate(`/players/${r.player.id}?season=${season}`)}
          pageSize={50}
          dense
          empty="No players match these filters. Try removing a filter or lowering the minimum minutes."
        />
      </Panel>
    </div>
  )
}
