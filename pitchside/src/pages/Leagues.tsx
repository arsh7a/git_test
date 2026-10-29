import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { ClubBadge, Flag } from '../components/Identity'
import { Panel, SampleBadge, SeasonSelect } from '../components/UI'
import { MIN_MINUTES, clubSummaries, clubsInLeague, dataset, getLeague, getSeasonRows, leaders, type ClubSeasonSummary } from '../data'
import { METRIC } from '../data/metrics'
import { formatMetric } from '../lib/format'
import { NotFound } from './NotFound'

export function Leagues() {
  const season = dataset.currentSeason
  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Leagues</h1>
          <p className="muted">{dataset.leagues.length} fictional leagues in the sample dataset · {season}</p>
        </div>
      </div>
      <div className="league-grid">
        {dataset.leagues.map((l) => {
          const scorer = leaders(season, 'goals', { leagueId: l.id, limit: 1 })[0]
          const creator = leaders(season, 'assists', { leagueId: l.id, limit: 1 })[0]
          const keeper = leaders(season, 'cleanSheets', { leagueId: l.id, limit: 1 })[0]
          const players = getSeasonRows(season).filter((r) => r.league.id === l.id).length
          return (
            <Link key={l.id} to={`/leagues/${l.id}`} className="league-card">
              <div className="league-card-head">
                <Flag code={l.nationCode} size={18} />
                <div>
                  <div className="league-name">{l.name}</div>
                  <div className="muted small">{l.country} · {clubsInLeague(l.id).length} clubs · {players} players</div>
                </div>
              </div>
              <dl className="league-leaders">
                {scorer && <><dt>Top scorer</dt><dd>{scorer.row.player.name} <b className="num">{scorer.value}</b></dd></>}
                {creator && <><dt>Most assists</dt><dd>{creator.row.player.name} <b className="num">{creator.value}</b></dd></>}
                {keeper && <><dt>Clean sheets</dt><dd>{keeper.row.player.name} <b className="num">{keeper.value}</b></dd></>}
              </dl>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const BOARDS = [
  { title: 'Goals', metricId: 'goals', per90: false, minMins: 0 },
  { title: 'Assists', metricId: 'assists', per90: false, minMins: 0 },
  { title: 'xAG per 90', metricId: 'xag', per90: true, minMins: MIN_MINUTES },
  { title: 'Prog. carries per 90', metricId: 'progCarries', per90: true, minMins: MIN_MINUTES },
  { title: 'Tkl + Int per 90', metricId: 'tklInt', per90: true, minMins: MIN_MINUTES },
  { title: 'Clean sheets', metricId: 'cleanSheets', per90: false, minMins: 0 },
]

export function LeagueDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const league = getLeague(id)
  if (!league) return <NotFound what="league" />
  const season = params.get('season') && dataset.seasons.includes(params.get('season')!) ? params.get('season')! : dataset.currentSeason
  const summaries = clubSummaries(league.id, season)

  const cols: Column<ClubSeasonSummary>[] = [
    { key: 'club', label: 'Club', align: 'left', sortValue: (r) => r.club.name, render: (r) => <span className="cell-club"><ClubBadge clubId={r.club.id} size={16} /> {r.club.name}</span> },
    { key: 'stadium', label: 'Stadium', align: 'left', render: (r) => <span className="muted">{r.club.stadium}</span> },
    { key: 'used', label: 'Players', title: 'Players used', align: 'right', sortValue: (r) => r.playersUsed, render: (r) => r.playersUsed },
    { key: 'age', label: 'Avg age', title: 'Average age, weighted by minutes played', align: 'right', sortValue: (r) => r.avgAge, render: (r) => r.avgAge.toFixed(1) },
    { key: 'goals', label: 'GF', title: 'Goals scored', align: 'right', sortValue: (r) => r.goals, render: (r) => r.goals },
    { key: 'xg', label: 'xG', title: 'Expected goals', align: 'right', sortValue: (r) => r.xg, render: (r) => r.xg.toFixed(1) },
    { key: 'ga', label: 'GA', title: 'Goals conceded', align: 'right', sortValue: (r) => r.goalsAgainst, render: (r) => r.goalsAgainst },
    { key: 'psxg', label: 'PSxG faced', title: 'Post-shot expected goals faced by the goalkeepers', align: 'right', sortValue: (r) => r.xga, render: (r) => r.xga.toFixed(1) },
    { key: 'gd', label: 'GD', title: 'Goal difference', align: 'right', sortValue: (r) => r.goals - r.goalsAgainst, render: (r) => <span className="num">{r.goals - r.goalsAgainst > 0 ? '+' : ''}{r.goals - r.goalsAgainst}</span> },
  ]

  return (
    <div className="container page">
      <div className="page-head">
        <div className="league-title">
          <Flag code={league.nationCode} size={22} />
          <div>
            <h1>{league.name} <SampleBadge /></h1>
            <p className="muted">{league.country} · {clubsInLeague(league.id).length} clubs · {league.matchesPerSeason} matches per season</p>
          </div>
        </div>
        <SeasonSelect value={season} seasons={dataset.seasons} onChange={(s) => setParams({ season: s }, { replace: true })} />
      </div>

      <Panel title="Clubs" actions={<span className="panel-meta">Season totals from player data · click a club to see its players</span>} flush>
        <DataTable columns={cols} rows={summaries} rowKey={(r) => r.club.id} initialSort={{ key: 'gd', dir: 'desc' }} onRowClick={(r) => navigate(`/stats?club=${r.club.id}&league=${league.id}&season=${season}`)} dense />
      </Panel>

      <div className="leader-grid leader-grid-3">
        {BOARDS.map((b) => (
          <Panel key={b.title} title={b.title} actions={b.minMins ? <span className="panel-meta">min {b.minMins} mins</span> : undefined} flush>
            <ol className="leaders">
              {leaders(season, b.metricId, { leagueId: league.id, per90: b.per90, minMins: b.minMins, limit: 5 }).map(({ row, value }, i) => (
                <li key={row.player.id}>
                  <span className="rank num">{i + 1}</span>
                  <Flag code={row.player.nationCode} size={10} />
                  <Link to={`/players/${row.player.id}?season=${season}`} className="leader-name">{row.player.name}</Link>
                  <span className="leader-club"><ClubBadge clubId={row.club.id} size={13} /> {row.club.shortName}</span>
                  <span className="leader-val num">{formatMetric(METRIC[b.metricId], value, b.per90)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
    </div>
  )
}
