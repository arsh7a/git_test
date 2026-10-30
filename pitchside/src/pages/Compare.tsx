import { Link, useSearchParams } from 'react-router-dom'
import { CompareView } from '../components/CompareView'
import { ClubBadge } from '../components/Identity'
import { Panel } from '../components/UI'
import { MIN_MINUTES, dataset, defaultSeasonFor, getPlayer, leaders, measuredInSeason } from '../data'
import type { PositionGroup } from '../data/types'
import { GROUP_LABEL } from '../data/metrics'

// Suggested match-ups: the top two players by a key stat (first available) in several positions.
const SUGGESTIONS: { group: PositionGroup; metricIds: string[] }[] = [
  { group: 'ST', metricIds: ['npg'] },
  { group: 'W', metricIds: ['xag', 'keyPasses'] },
  { group: 'CM', metricIds: ['progPasses', 'keyPasses'] },
  { group: 'CB', metricIds: ['tklInt'] },
  { group: 'GK', metricIds: ['psxgDiff', 'savePct'] },
]

export function Compare() {
  const [params, setParams] = useSearchParams()
  const a = getPlayer(params.get('a') ?? '')
  const b = getPlayer(params.get('b') ?? '')
  const seasonA = params.get('sa') ?? (a ? defaultSeasonFor(a.id) : dataset.currentSeason)
  const seasonB = params.get('sb') ?? (b ? defaultSeasonFor(b.id) : dataset.currentSeason)

  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(values)) next.set(k, v)
    setParams(next, { replace: true })
  }

  const suggestions = SUGGESTIONS.map((s) => {
    const top = leaders(dataset.currentSeason, s.metricIds.find((id) => measuredInSeason(id, dataset.currentSeason)) ?? '', { groups: [s.group], minMins: MIN_MINUTES, per90: true, limit: 2 })
    return { ...s, pair: top.map((t) => t.row) }
  }).filter((s) => s.pair.length === 2)

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Compare players</h1>
          <p className="muted">Pick any two players. Percentiles compare each player with others in their position group.</p>
        </div>
      </div>
      <CompareView
        a={a}
        b={b}
        seasonA={seasonA}
        seasonB={seasonB}
        onPick={(side, p) => update(side === 'a' ? { a: p.id, sa: defaultSeasonFor(p.id) } : { b: p.id, sb: defaultSeasonFor(p.id) })}
        onSeason={(side, s) => update({ [side === 'a' ? 'sa' : 'sb']: s })}
      />
      {(!a || !b) && (
        <Panel title="Suggested comparisons" actions={<span className="panel-meta">{dataset.currentSeason}{dataset.isSample ? ' · sample data' : ''}</span>} flush>
          <ul className="suggest">
            {suggestions.map((s) => (
              <li key={s.group}>
                <span className="suggest-group">{GROUP_LABEL[s.group]}</span>
                <Link to={`/compare?a=${s.pair[0].player.id}&b=${s.pair[1].player.id}`} className="suggest-pair">
                  <span><ClubBadge clubId={s.pair[0].club.id} size={14} /> {s.pair[0].player.name}</span>
                  <span className="muted">vs</span>
                  <span><ClubBadge clubId={s.pair[1].club.id} size={14} /> {s.pair[1].player.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
