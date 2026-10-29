import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ageOn, getClub, getPlayerSeason, getPlayerSeasons, percentile } from '../data'
import { GROUP_LABEL, METRIC, RADAR_TEMPLATES, SCOUT_TEMPLATE_GK, SCOUT_TEMPLATE_OUTFIELD, metricValue } from '../data/metrics'
import type { Player, PlayerSeason } from '../data/types'
import { formatMetric } from '../lib/format'
import { RadarChart } from './Charts'
import { ClubBadge, Flag, PlayerAvatar } from './Identity'
import { SearchBox } from './SearchBox'
import { Panel, Segmented, SeasonSelect } from './UI'

type Side = 'a' | 'b'

interface Props {
  a?: Player
  b?: Player
  seasonA: string
  seasonB: string
  onPick: (side: Side, p: Player) => void
  onSeason: (side: Side, season: string) => void
  lockA?: boolean
}

function PlayerSlot({ side, player, season, onPick, onSeason, locked, excludeId }: { side: Side; player?: Player; season: string; onPick: (p: Player) => void; onSeason: (s: string) => void; locked?: boolean; excludeId?: string }) {
  const [changing, setChanging] = useState(false)
  const label = side === 'a' ? 'Player A' : 'Player B'
  if (!player || changing) {
    return (
      <div className={`cmp-slot cmp-slot-${side} empty`}>
        <div className="cmp-slot-label">{label}</div>
        <SearchBox
          variant="picker"
          placeholder={`Search for ${label.toLowerCase()}…`}
          autoFocus={changing}
          excludeId={excludeId}
          onSelect={(p) => {
            setChanging(false)
            onPick(p)
          }}
        />
        {changing && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChanging(false)}>Cancel</button>
        )}
      </div>
    )
  }
  const club = getClub(player.clubId)!
  const seasons = getPlayerSeasons(player.id).map((r) => r.season)
  const row = getPlayerSeason(player.id, season)
  return (
    <div className={`cmp-slot cmp-slot-${side}`}>
      <PlayerAvatar player={player} size={56} />
      <div className="cmp-slot-id">
        <div className="cmp-slot-label"><i className={`swatch swatch-${side}`} /> {label}</div>
        <Link to={`/players/${player.id}?season=${season}`} className="cmp-name">{player.name}</Link>
        <div className="cmp-meta">
          <span className="pos-badge">{player.primaryPosition}</span>
          <ClubBadge clubId={club.id} size={14} /> {club.shortName}
          <span className="sep" />
          <Flag code={player.nationCode} size={10} /> {ageOn(player.birthDate)} yrs
        </div>
        <div className="cmp-meta muted small">{row ? `${row.stats.mins.toLocaleString('en-GB')} mins · ${row.stats.apps} apps in ${season}` : 'No minutes in this season'}</div>
      </div>
      <div className="cmp-slot-actions">
        {seasons.length > 0 && <SeasonSelect value={season} seasons={seasons} onChange={onSeason} />}
        {!locked && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChanging(true)}>Change</button>
        )}
      </div>
    </div>
  )
}

function better(metricId: string, va: number | null, vb: number | null): Side | null {
  if (va == null || vb == null || Math.abs(va - vb) < 1e-9) return null
  const lower = METRIC[metricId].lowerIsBetter
  return (va > vb) !== !!lower ? 'a' : 'b'
}

export function CompareView({ a, b, seasonA, seasonB, onPick, onSeason, lockA }: Props) {
  const [mode, setMode] = useState<'per90' | 'total'>('per90')
  const rowA = a ? getPlayerSeason(a.id, seasonA) : undefined
  const rowB = b ? getPlayerSeason(b.id, seasonB) : undefined

  return (
    <div className="compare">
      <div className="cmp-slots">
        <PlayerSlot side="a" player={a} season={seasonA} onPick={(p) => onPick('a', p)} onSeason={(s) => onSeason('a', s)} locked={lockA} excludeId={b?.id} />
        <div className="cmp-vs" aria-hidden="true">vs</div>
        <PlayerSlot side="b" player={b} season={seasonB} onPick={(p) => onPick('b', p)} onSeason={(s) => onSeason('b', s)} excludeId={a?.id} />
      </div>
      {a && b && rowA && rowB ? (
        <CompareBody a={a} b={b} rowA={rowA} rowB={rowB} mode={mode} setMode={setMode} />
      ) : (
        <Panel>
          <p className="empty-state">
            {a && b ? 'One of these players has no minutes in the chosen season. Pick another season.' : 'Choose two players to see a side-by-side comparison.'}
          </p>
        </Panel>
      )}
    </div>
  )
}

function CompareBody({ a, b, rowA, rowB, mode, setMode }: { a: Player; b: Player; rowA: PlayerSeason; rowB: PlayerSeason; mode: 'per90' | 'total'; setMode: (m: 'per90' | 'total') => void }) {
  const bothGK = a.group === 'GK' && b.group === 'GK'
  const mixedGK = (a.group === 'GK') !== (b.group === 'GK')
  const per90 = mode === 'per90'
  const template = bothGK ? SCOUT_TEMPLATE_GK : SCOUT_TEMPLATE_OUTFIELD
  const radarIds = RADAR_TEMPLATES[a.group === 'GK' && !bothGK ? b.group : a.group]

  const pctA = (id: string) => percentile(id, rowA.stats, rowA.season, a.group)
  const pctB = (id: string) => percentile(id, rowB.stats, rowB.season, b.group)

  const keyIds = bothGK
    ? ['apps', 'mins', 'goalsAgainst', 'savePct', 'cleanSheets', 'psxgDiff']
    : ['apps', 'mins', 'goals', 'assists', 'npxg', 'xag', 'sca', 'tklInt']

  const allIds = template.flatMap((c) => c.metrics)
  let winsA = 0
  let winsB = 0
  for (const id of allIds) {
    const w = better(id, metricValue(METRIC[id], rowA.stats, per90 && METRIC[id].per90), metricValue(METRIC[id], rowB.stats, per90 && METRIC[id].per90))
    if (w === 'a') winsA++
    if (w === 'b') winsB++
  }

  return (
    <>
      {mixedGK && <p className="note">Comparing a goalkeeper with an outfield player — most statistics do not apply to both.</p>}
      {a.group !== b.group && !mixedGK && (
        <p className="note">
          Different positions: each player’s percentiles are measured against their own group ({GROUP_LABEL[a.group].toLowerCase()} vs {GROUP_LABEL[b.group].toLowerCase()}).
        </p>
      )}
      <div className="cmp-top">
        <Panel title="Percentile profile" actions={<span className="panel-meta">Each player vs their position peers</span>}>
          <RadarChart
            metrics={radarIds}
            series={[
              { name: a.lastName, colorVar: '--series-a', values: radarIds.map(pctA), raw: radarIds.map((id) => metricValue(METRIC[id], rowA.stats, METRIC[id].per90)) },
              { name: b.lastName, colorVar: '--series-b', values: radarIds.map(pctB), raw: radarIds.map((id) => metricValue(METRIC[id], rowB.stats, METRIC[id].per90)) },
            ]}
          />
          <div className="legend">
            <span><i className="swatch swatch-a" /> {a.name} ({rowA.season})</span>
            <span><i className="swatch swatch-b" /> {b.name} ({rowB.season})</span>
          </div>
        </Panel>
        <Panel title="Head to head" actions={<Segmented label="Value type" value={mode} onChange={setMode} options={[{ value: 'per90', label: 'Per 90' }, { value: 'total', label: 'Totals' }]} />}>
          <div className="h2h-score">
            <div className="h2h-side a"><span className="num">{winsA}</span><small>{a.lastName} leads</small></div>
            <div className="h2h-bar" aria-hidden="true">
              <span className="h2h-a" style={{ flex: winsA || 0.001 }} />
              <span className="h2h-b" style={{ flex: winsB || 0.001 }} />
            </div>
            <div className="h2h-side b"><span className="num">{winsB}</span><small>{b.lastName} leads</small></div>
          </div>
          <p className="muted small h2h-caption">Number of the {allIds.length} statistics below where each player is ahead ({per90 ? 'per 90' : 'season totals'}).</p>
          <table className="tbl tbl-dense key-cmp">
            <tbody>
              {keyIds.map((id) => {
                const m = METRIC[id]
                const va = metricValue(m, rowA.stats, per90 && m.per90)
                const vb = metricValue(m, rowB.stats, per90 && m.per90)
                const w = ['apps', 'mins'].includes(id) ? null : better(id, va, vb)
                return (
                  <tr key={id}>
                    <td className={`al-right num ${w === 'a' ? 'win win-a' : ''}`}>{formatMetric(m, va, per90)}</td>
                    <td className="al-center key-label">{m.label}{per90 && m.per90 ? ' /90' : ''}</td>
                    <td className={`al-left num ${w === 'b' ? 'win win-b' : ''}`}>{formatMetric(m, vb, per90)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel
        title="Statistical breakdown"
        actions={
          <span className="panel-meta">
            Bars show percentile vs position peers · <b className="win-a-text">bold</b> = better value
          </span>
        }
        flush
      >
        <div className="cmp-head-row-outer">
          <div className="cmp-head-row">
          <span className="al-right"><i className="swatch swatch-a" /> {a.lastName}</span>
          <span className="al-right muted">Pct</span>
          <span />
          <span className="al-center">{per90 ? 'Value: per 90 / rate' : 'Value: season total / rate'}</span>
          <span />
          <span className="al-left muted">Pct</span>
          <span className="al-left"><i className="swatch swatch-b" /> {b.lastName}</span>
        </div>
        </div>
        {template.map((cat) => (
          <div key={cat.category} className="cmp-cat">
            <h3 className="cmp-cat-title">{cat.category}</h3>
            {cat.metrics.map((id) => {
              const m = METRIC[id]
              const usePer90 = per90 && m.per90
              const va = metricValue(m, rowA.stats, usePer90)
              const vb = metricValue(m, rowB.stats, usePer90)
              const pa = pctA(id)
              const pb = pctB(id)
              const w = better(id, va, vb)
              return (
                <div key={id} className="cmp-row" data-tip={`${m.label}: ${a.lastName} ${pa ?? '—'} pct · ${b.lastName} ${pb ?? '—'} pct`}>
                  <span className={`cmp-val al-right num ${w === 'a' ? 'win win-a' : ''}`}>{formatMetric(m, va, usePer90)}</span>
                  <em className="cmp-pct num">{pa ?? '—'}</em>
                  <span className="cmp-bar cmp-bar-a"><span style={{ width: `${pa ?? 0}%` }} /></span>
                  <span className="cmp-label" title={m.description}>{m.label}</span>
                  <span className="cmp-bar cmp-bar-b"><span style={{ width: `${pb ?? 0}%` }} /></span>
                  <em className="cmp-pct num">{pb ?? '—'}</em>
                  <span className={`cmp-val al-left num ${w === 'b' ? 'win win-b' : ''}`}>{formatMetric(m, vb, usePer90)}</span>
                </div>
              )
            })}
          </div>
        ))}
      </Panel>
    </>
  )
}
