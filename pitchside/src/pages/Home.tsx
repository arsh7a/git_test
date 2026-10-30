import { Link } from 'react-router-dom'
import { ClubBadge, Flag, PlayerAvatar } from '../components/Identity'
import { SearchBox } from '../components/SearchBox'
import { Panel } from '../components/UI'
import { MIN_MINUTES, dataset, getSeasonRows, leaders, measuredInSeason, type SeasonRow } from '../data'
import { GROUP_SHORT, METRIC } from '../data/metrics'
import { formatMetric } from '../lib/format'

const season = dataset.currentSeason

function pickFeatured() {
  const rows = getSeasonRows(season).filter((r) => r.stats.mins >= MIN_MINUTES)
  const used = new Set<string>()
  // `metricIds` are in order of preference; the first one the data source has is used.
  const best = (label: string, metricIds: string[], filter: (r: SeasonRow) => boolean, per90: boolean) => {
    const metricId = metricIds.find((id) => measuredInSeason(id, season))
    if (!metricId) return null
    const m = METRIC[metricId]
    const list = rows
      .filter((r) => filter(r) && !used.has(r.player.id))
      .map((r) => ({ r, v: (m.per90 && per90 ? m.value(r.stats)! / (r.stats.mins / 90) : m.value(r.stats)) ?? -Infinity }))
      .sort((x, y) => y.v - x.v)
    const top = list[0]
    if (!top) return null
    used.add(top.r.player.id)
    return { label, row: top.r, value: formatMetric(m, top.v, per90 && m.per90), unit: `${m.short}${per90 && m.per90 ? ' per 90' : ''}` }
  }
  return [
    best('Top scorer', ['goals'], () => true, false),
    best('Chief creator', ['xag', 'keyPasses'], (r) => ['AM', 'W', 'CM'].includes(r.player.group), true),
    best('Ball progressor', ['progPasses', 'progCarries', 'dribblesSucc'], (r) => ['CM', 'DM'].includes(r.player.group), true),
    best('Defensive anchor', ['tklInt'], (r) => ['CB', 'DM', 'FB'].includes(r.player.group), true),
    best('Shot stopper', ['psxgDiff', 'savePct'], (r) => r.player.group === 'GK', false),
    best('Rising talent (U21)', ['npxgXag', 'ga'], (r) => r.age != null && r.age <= 21, true),
  ].filter((f) => f != null)
}

const featured = pickFeatured()

// Expected-goal stats fall back to goal involvement when the data source has no xG.
const INVOLVEMENT = ['npxgXag', 'ga'].find((id) => measuredInSeason(id, season))!

const LEADER_BOARDS = [
  { title: 'Goals', metricId: 'goals', per90: false, minMins: 0 },
  { title: 'Assists', metricId: 'assists', per90: false, minMins: 0 },
  { title: `${METRIC[INVOLVEMENT].short} per 90`, metricId: INVOLVEMENT, per90: true, minMins: MIN_MINUTES },
  { title: 'Tkl + Int per 90', metricId: 'tklInt', per90: true, minMins: MIN_MINUTES },
]

export function Home() {
  const popular = leaders(season, INVOLVEMENT, { limit: 6 })

  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-inner">
          <h1>Football player statistics, built for scouting.</h1>
          <p className="hero-sub">
            Profiles, percentile rankings and side-by-side comparisons for {dataset.players.length.toLocaleString('en-GB')} players across {dataset.leagues.length} leagues.
          </p>
          <SearchBox variant="hero" placeholder="Search for a player or club…" autoFocus />
          <div className="popular">
            <span className="muted small">Popular:</span>
            {popular.map(({ row }) => (
              <Link key={row.player.id} to={`/players/${row.player.id}`} className="chip">
                {row.player.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="container home-body">
        <div className="quick-links">
          <Link to="/compare" className="qlink">
            <strong>Compare players</strong>
            <span>Radar charts, percentiles and head-to-head stats for any two players.</span>
          </Link>
          <Link to="/stats" className="qlink">
            <strong>Statistics database</strong>
            <span>Filter and sort every player by league, position, age and 50+ metrics.</span>
          </Link>
          <Link to="/leagues" className="qlink">
            <strong>Leagues</strong>
            <span>Club overviews and season leaders for {dataset.leagues.length} leagues.</span>
          </Link>
        </div>

        <Panel title="Featured players" actions={<span className="panel-meta">{season}{dataset.isSample ? ' · sample data' : ''}</span>}>
          <div className="featured">
            {featured.map((f) => (
              <Link key={f.label} to={`/players/${f.row.player.id}`} className="fcard">
                <div className="fcard-label">{f.label}</div>
                <div className="fcard-main">
                  <PlayerAvatar player={f.row.player} size={44} />
                  <div className="fcard-id">
                    <div className="fcard-name">{f.row.player.name}</div>
                    <div className="fcard-meta">
                      <span className="pos-badge">{GROUP_SHORT[f.row.player.group]}</span>
                      <ClubBadge clubId={f.row.club.id} size={13} /> <span className="ellipsis">{f.row.club.shortName}</span>
                    </div>
                  </div>
                </div>
                <div className="fcard-stat">
                  <span className="num">{f.value}</span>
                  <small>{f.unit}</small>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="leader-grid">
          {LEADER_BOARDS.map((b) => (
            <Panel
              key={b.title}
              title={b.title}
              actions={b.minMins ? <span className="panel-meta">min {b.minMins} mins</span> : undefined}
              flush
            >
              <ol className="leaders">
                {leaders(season, b.metricId, { per90: b.per90, minMins: b.minMins, limit: 5 }).map(({ row, value }, i) => (
                  <li key={row.player.id}>
                    <span className="rank num">{i + 1}</span>
                    <Flag code={row.player.nationCode} size={10} />
                    <Link to={`/players/${row.player.id}`} className="leader-name">{row.player.name}</Link>
                    <span className="leader-club"><ClubBadge clubId={row.club.id} size={13} /> {row.club.shortName}</span>
                    <span className="leader-val num">{formatMetric(METRIC[b.metricId], value, b.per90)}</span>
                  </li>
                ))}
              </ol>
              <Link className="panel-foot-link" to={`/stats?sort=${b.metricId}${b.per90 ? '&per90=1' : ''}${b.minMins ? `&minMins=${b.minMins}` : ''}&view=${b.metricId === 'tklInt' ? 'defending' : 'standard'}`}>
                Full table →
              </Link>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  )
}
