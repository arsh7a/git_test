import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CompareView } from '../components/CompareView'
import { PercentileBar, PositionMap, RadarChart, SeasonBars } from '../components/Charts'
import { DataTable, type Column } from '../components/DataTable'
import { ClubBadge, Flag, PlayerAvatar } from '../components/Identity'
import { Panel, SampleBadge, SeasonSelect, StatTile } from '../components/UI'
import {
  MIN_MINUTES,
  ageOn,
  dataset,
  defaultSeasonFor,
  getClub,
  getLeague,
  getNation,
  getPlayer,
  getPlayerSeason,
  getPlayerSeasons,
  percentile,
  percentileItems,
  poolSize,
  scoutTemplate,
  similarPlayers,
  strengthsAndWeaknesses,
} from '../data'
import { GROUP_LABEL, METRIC, METRICS, RADAR_TEMPLATES, hasMetric, metricValue, type MetricCategory } from '../data/metrics'
import type { Player, PlayerSeason } from '../data/types'
import { formatDate, formatMetric, ordinal } from '../lib/format'
import { NotFound } from './NotFound'

const TABS = [
  { path: '', label: 'Overview' },
  { path: 'statistics', label: 'Statistics' },
  { path: 'comparison', label: 'Comparison' },
  { path: 'career', label: 'Career' },
]

export function PlayerProfile() {
  const { id = '', tab = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const player = getPlayer(id)
  if (!player) return <NotFound what="player" />

  const seasons = getPlayerSeasons(player.id).map((r) => r.season)
  const season = params.get('season') && seasons.includes(params.get('season')!) ? params.get('season')! : defaultSeasonFor(player.id)
  const row = getPlayerSeason(player.id, season)
  const setSeason = (s: string) => {
    const next = new URLSearchParams(params)
    next.set('season', s)
    setParams(next, { replace: true })
  }
  const query = params.toString() ? `?${params.toString()}` : ''

  return (
    <div className="container profile">
      <ProfileHeader player={player} season={season} seasons={seasons} onSeason={setSeason} />
      <nav className="tabs" aria-label="Player sections">
        {TABS.map((t) => (
          <NavLink key={t.label} end to={`/players/${player.id}${t.path ? '/' + t.path : ''}${query}`} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      {!row ? (
        <Panel>
          <p className="empty-state">No league minutes are recorded for {player.name} in this data.</p>
        </Panel>
      ) : tab === '' ? (
        <Overview player={player} row={row} />
      ) : tab === 'statistics' ? (
        <StatisticsTab player={player} row={row} />
      ) : tab === 'comparison' ? (
        <ComparisonTab player={player} season={season} />
      ) : tab === 'career' ? (
        <CareerTab player={player} />
      ) : (
        <NotFound what="page" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ProfileHeader({ player, season, seasons, onSeason }: { player: Player; season: string; seasons: string[]; onSeason: (s: string) => void }) {
  const club = getClub(player.clubId)!
  const league = getLeague(club.leagueId)!
  const nation = getNation(player.nationCode)
  const age = ageOn(player.birthDate)
  return (
    <header className="phead">
      <div className="phead-stripe" style={{ background: `linear-gradient(90deg, ${club.colors[0]} 0 50%, ${club.colors[1]} 50% 100%)` }} />
      <div className="phead-main">
        <PlayerAvatar player={player} size={92} />
        <div className="phead-id">
          <div className="phead-top">
            {player.shirtNumber != null && <span className="shirt num" title="Shirt number">{player.shirtNumber}</span>}
            <h1>{player.name}</h1>
            <SampleBadge />
          </div>
          <div className="phead-sub">
            <span className="pos-badge">{player.primaryPosition}</span>
            <span>{GROUP_LABEL[player.group].replace(/s$/, '')}</span>
            <span className="sep" />
            <Link to={`/stats?club=${club.id}`} className="club-link">
              <ClubBadge clubId={club.id} size={16} /> {club.name}
            </Link>
            <span className="sep" />
            <Link to={`/leagues/${league.id}`}>{league.name}</Link>
            <span className="sep" />
            <span className="nat"><Flag code={player.nationCode} size={11} /> {nation?.name}</span>
          </div>
        </div>
        <dl className="phead-facts">
          <div><dt>Age</dt><dd className="num">{age}</dd><dd className="sub">{formatDate(player.birthDate)}</dd></div>
          {player.heightCm > 0 && <div><dt>Height</dt><dd className="num">{player.heightCm} cm</dd></div>}
          {player.foot && <div><dt>Foot</dt><dd>{player.foot}</dd></div>}
          {player.contractUntil && <div><dt>Contract</dt><dd className="num">Jun {player.contractUntil}</dd></div>}
        </dl>
        <div className="phead-actions">
          <SeasonSelect value={season} seasons={seasons.length ? seasons : [season]} onChange={onSeason} />
          <Link className="btn" to={`/compare?a=${player.id}`}>Compare</Link>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function SeasonSummary({ player, row }: { player: Player; row: PlayerSeason }) {
  const s = row.stats
  const club = getClub(row.clubId)!
  const league = getLeague(row.leagueId)!
  const p90 = (v: number) => (s.mins ? (v / (s.mins / 90)).toFixed(2) : '—')
  return (
    <Panel title={`${row.season} season`} actions={<span className="panel-meta"><ClubBadge clubId={club.id} size={13} /> {club.shortName} · {league.name}</span>}>
      <div className="tiles">
        <StatTile label="Appearances" value={s.apps} sub={`${s.starts} starts`} />
        <StatTile label="Minutes" value={s.mins.toLocaleString('en-GB')} sub={`${Math.round((s.mins / (league.matchesPerSeason * 90)) * 100)}% of max`} />
        {player.group === 'GK' ? (
          <>
            {hasMetric('cleanSheets') ? (
              <StatTile label="Clean sheets" value={s.cleanSheets} sub={s.starts ? `${Math.round((s.cleanSheets / s.starts) * 100)}% of starts` : '—'} />
            ) : (
              hasMetric('rating') && <RatingTile s={s} />
            )}
            <StatTile label="Conceded" value={s.goalsAgainst} sub={`${p90(s.goalsAgainst)} per 90`} />
            <StatTile label="Save %" value={formatMetric(METRIC.savePct, metricValue(METRIC.savePct, s, false))} sub={`${s.saves} saves`} />
            {hasMetric('psxgDiff') ? (
              <StatTile label="Goals prevented" value={(s.psxg - s.goalsAgainst > 0 ? '+' : '') + (s.psxg - s.goalsAgainst).toFixed(1)} sub="PSxG − GA" />
            ) : (
              <StatTile label="Saves" value={s.saves} sub={`${p90(s.saves)} per 90`} />
            )}
          </>
        ) : (
          <>
            <StatTile label="Goals" value={s.goals} sub={`${p90(s.goals)} per 90${s.pkGoals ? ` · ${s.pkGoals} pen` : ''}`} />
            <StatTile label="Assists" value={s.assists} sub={`${p90(s.assists)} per 90`} />
            {hasMetric('xg') ? (
              <>
                <StatTile label="xG" value={s.xg.toFixed(1)} sub={`npxG ${s.npxg.toFixed(1)}`} />
                <StatTile label="xAG" value={s.xag.toFixed(1)} sub={`${p90(s.xag)} per 90`} />
              </>
            ) : (
              <>
                <StatTile label="Shots" value={s.shots} sub={`${s.sot} on target`} />
                {hasMetric('rating') ? <RatingTile s={s} /> : <StatTile label="Key passes" value={s.keyPasses} sub={`${p90(s.keyPasses)} per 90`} />}
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

function RatingTile({ s }: { s: PlayerSeason['stats'] }) {
  return <StatTile label="Avg rating" value={formatMetric(METRIC.rating, metricValue(METRIC.rating, s, false))} sub="minutes-weighted" />
}

function PlayerDetails({ player }: { player: Player }) {
  const club = getClub(player.clubId)!
  return (
    <Panel title="Details">
      <dl className="details">
        <dt>Full name</dt><dd>{player.firstName} {player.lastName}</dd>
        <dt>Date of birth</dt><dd>{formatDate(player.birthDate)} ({ageOn(player.birthDate)})</dd>
        <dt>Nationality</dt><dd><Flag code={player.nationCode} size={11} /> {getNation(player.nationCode)?.name}</dd>
        {player.heightCm > 0 && <><dt>Height</dt><dd>{player.heightCm} cm</dd></>}
        {player.foot && <><dt>Preferred foot</dt><dd>{player.foot}</dd></>}
        <dt>Club</dt><dd><Link to={`/stats?club=${club.id}`}>{club.name}</Link></dd>
        {player.shirtNumber != null && <><dt>Shirt number</dt><dd>{player.shirtNumber}</dd></>}
        {player.contractUntil && <><dt>Contract expires</dt><dd>30 Jun {player.contractUntil}</dd></>}
      </dl>
    </Panel>
  )
}

function scoutingSentence(player: Player, strengths: { metricId: string; pct: number }[], mins: number) {
  const role = GROUP_LABEL[player.group].toLowerCase()
  if (mins < MIN_MINUTES) return `Limited minutes this season — treat these rankings as indicative only.`
  if (!strengths.length) return `A solid all-round profile without a standout statistical strength among ${role}.`
  const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1)
  const top = strengths.slice(0, 2).map((s) => lower(METRIC[s.metricId].label))
  const best = strengths[0]
  return `Stands out among ${role} for ${top.join(' and ')}${best.pct >= 95 ? `, ranking in the ${ordinal(best.pct)} percentile for ${lower(METRIC[best.metricId].label)}` : ''}.`
}

function Overview({ player, row }: { player: Player; row: PlayerSeason }) {
  const { season, stats } = row
  const peers = GROUP_LABEL[player.group]
  const n = poolSize(season, player.group)
  const { strengths, weaknesses } = strengthsAndWeaknesses(stats, season, player.group)
  const radarIds = RADAR_TEMPLATES[player.group]
  const radarItems = percentileItems(radarIds, stats, season, player.group)
  const similar = similarPlayers(player.id, season)
  const history = getPlayerSeasons(player.id)
  const lowMins = stats.mins < MIN_MINUTES

  return (
    <div className="overview">
      <div className="col col-left">
        <SeasonSummary player={player} row={row} />
        <Panel title="Positions">
          <PositionMap primary={player.primaryPosition} secondary={player.secondaryPositions} />
        </Panel>
        <PlayerDetails player={player} />
      </div>

      <div className="col col-mid">
        <Panel title="Scouting summary">
          <p className="scout-line">{scoutingSentence(player, strengths, stats.mins)}</p>
          <div className="sw">
            <div>
              <h3 className="sw-title sw-good">Strengths</h3>
              {strengths.length === 0 && <p className="muted small">No stat in the top 20% of {peers.toLowerCase()}.</p>}
              <ul className="sw-list">
                {strengths.map((s) => (
                  <li key={s.metricId} title={METRIC[s.metricId].description}>
                    <span>{METRIC[s.metricId].label}</span>
                    <span className="sw-pct num good">{ordinal(s.pct)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="sw-title sw-bad">Weaknesses</h3>
              {weaknesses.length === 0 && <p className="muted small">No stat in the bottom 25% of {peers.toLowerCase()}.</p>}
              <ul className="sw-list">
                {weaknesses.map((s) => (
                  <li key={s.metricId} title={METRIC[s.metricId].description}>
                    <span>{METRIC[s.metricId].label}</span>
                    <span className="sw-pct num bad">{ordinal(s.pct)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel
          title="Percentile rankings"
          actions={<span className="panel-meta">vs {n} {peers.toLowerCase()} · {season} · min {MIN_MINUTES} mins</span>}
        >
          {lowMins && (
            <p className="note">Only {stats.mins} minutes played this season — below the {MIN_MINUTES}-minute threshold, so these rankings are less reliable.</p>
          )}
          <div className="pbar-head">
            <span>Statistic</span>
            <span className="al-right">Per 90</span>
            <span className="pbar-scale"><span>0</span><span>50</span><span>100</span></span>
            <span className="al-right">Pct</span>
          </div>
          {scoutTemplate(player.group).map((cat) => (
            <div key={cat.category} className="pbar-group">
              <h3 className="pbar-cat">{cat.category}</h3>
              {percentileItems(cat.metrics, stats, season, player.group).map((it) => (
                <PercentileBar key={it.metricId} metricId={it.metricId} value={it.value} pct={it.pct} peerLabel={peers} />
              ))}
            </div>
          ))}
        </Panel>
      </div>

      <div className="col col-right">
        <Panel title="Profile radar" actions={<span className="panel-meta">Percentile vs {peers.toLowerCase()}</span>}>
          <RadarChart
            metrics={radarIds}
            series={[{ name: player.lastName, colorVar: '--series-a', values: radarItems.map((i) => i.pct), raw: radarItems.map((i) => i.value) }]}
          />
        </Panel>
        <Panel title="Similar players" actions={<span className="panel-meta">{season} · by percentile profile</span>} flush>
          {similar.length === 0 ? (
            <p className="empty-state small">Not enough comparable players.</p>
          ) : (
            <ul className="similar">
              {similar.map(({ row: r, similarity }) => (
                <li key={r.player.id}>
                  <Link to={`/players/${r.player.id}?season=${season}`} className="similar-main">
                    <ClubBadge clubId={r.club.id} size={18} />
                    <span className="similar-name">{r.player.name}</span>
                    <span className="similar-meta">{r.club.shortName} · {r.age}</span>
                  </Link>
                  <span className="similar-score num" title="Similarity of percentile profiles (100 = identical)">{similarity}%</span>
                  <Link className="similar-cmp" to={`/compare?a=${player.id}&b=${r.player.id}&sa=${season}&sb=${season}`} title={`Compare with ${r.player.name}`}>
                    Compare
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {history.length > 1 && (
          <Panel title="Recent seasons">
            {player.group === 'GK' && hasMetric('cleanSheets') ? (
              <SeasonBars title="Clean sheets" items={history.map((h) => ({ label: h.season, value: h.stats.cleanSheets }))} format={(v) => String(v)} />
            ) : player.group === 'GK' ? (
              <SeasonBars title="Saves" items={history.map((h) => ({ label: h.season, value: h.stats.saves }))} format={(v) => String(v)} />
            ) : (
              <SeasonBars title="Goals + assists" items={history.map((h) => ({ label: h.season, value: h.stats.goals + h.stats.assists }))} format={(v) => String(v)} />
            )}
            <SeasonBars title="Minutes" items={history.map((h) => ({ label: h.season, value: h.stats.mins }))} format={(v) => v.toLocaleString('en-GB')} />
          </Panel>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Statistics tab: every stat by category, with totals, per 90 and percentile.
// ---------------------------------------------------------------------------

const OUTFIELD_CATS: MetricCategory[] = ['Playing time', 'Shooting', 'Creation', 'Passing', 'Possession', 'Defending', 'Discipline']
const GK_CATS: MetricCategory[] = ['Playing time', 'Goalkeeping', 'Passing', 'Discipline']

function StatisticsTab({ player, row }: { player: Player; row: PlayerSeason }) {
  const { stats, season } = row
  const isGK = player.group === 'GK'
  const cats = isGK ? GK_CATS : OUTFIELD_CATS
  return (
    <>
      <p className="tab-intro muted">
        All {season} league statistics for {player.name}. Percentiles compare per-90 values with {GROUP_LABEL[player.group].toLowerCase()} who played at least {MIN_MINUTES} minutes.
      </p>
      <div className="stat-grid">
        {cats.map((cat) => {
          const metrics = METRICS.filter((m) => m.category === cat && (m.scope === 'all' || m.scope === (isGK ? 'gk' : 'outfield')))
          return (
            <Panel key={cat} title={cat} flush>
              <table className="tbl tbl-dense stat-table">
                <thead>
                  <tr>
                    <th>Statistic</th>
                    <th className="al-right">Total</th>
                    <th className="al-right">Per 90</th>
                    <th className="al-right pct-col">Percentile</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const total = metricValue(m, stats, false)
                    const per90 = m.per90 ? metricValue(m, stats, true) : null
                    const pct = cat === 'Playing time' ? null : percentile(m.id, stats, season, player.group)
                    return (
                      <tr key={m.id}>
                        <td title={m.description}><span className="has-tip">{m.label}</span></td>
                        <td className="al-right num">{formatMetric(m, total)}</td>
                        <td className="al-right num">{m.per90 ? formatMetric(m, per90, true) : <span className="muted">—</span>}</td>
                        <td className="al-right pct-col">
                          {pct == null ? (
                            <span className="muted">—</span>
                          ) : (
                            <span className="mini-pct">
                              <span className="mini-track"><span className="mini-fill" style={{ width: `${pct}%` }} /></span>
                              <span className="num">{pct}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Comparison tab
// ---------------------------------------------------------------------------

function ComparisonTab({ player, season }: { player: Player; season: string }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const vsId = params.get('vs')
  const fallback = similarPlayers(player.id, season, 1)[0]?.row.player
  const other = (vsId && getPlayer(vsId)) || fallback
  const otherSeason = other ? (params.get('vsSeason') ?? defaultSeasonFor(other.id)) : dataset.currentSeason
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(values)) next.set(k, v)
    setParams(next, { replace: true })
  }
  return (
    <>
      {!vsId && fallback && (
        <p className="tab-intro muted">Showing {player.name} against their most similar player. Choose anyone else on the right.</p>
      )}
      <CompareView
        a={player}
        b={other}
        seasonA={season}
        seasonB={otherSeason}
        onPick={(side, p) => (side === 'a' ? navigate(`/players/${p.id}/comparison`) : update({ vs: p.id, vsSeason: defaultSeasonFor(p.id) }))}
        onSeason={(side, s) => update({ [side === 'a' ? 'season' : 'vsSeason']: s })}
        lockA
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Career tab
// ---------------------------------------------------------------------------

function CareerTab({ player }: { player: Player }) {
  const rows = getPlayerSeasons(player.id)
  const isGK = player.group === 'GK'
  const total = rows.reduce(
    (acc, r) => {
      for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += r.stats[k]
      return acc
    },
    { apps: 0, starts: 0, mins: 0, goals: 0, assists: 0, xg: 0, xag: 0, npxg: 0, goalsAgainst: 0, saves: 0, sotAgainst: 0, cleanSheets: 0, psxg: 0, yellows: 0, reds: 0 },
  )
  const p90 = (v: number, mins: number) => (mins ? (v / (mins / 90)).toFixed(2) : '—')
  const hasCS = hasMetric('cleanSheets')
  const hasPsxg = hasMetric('psxgDiff')
  const hasXg = hasMetric('xg')

  // Club spells, FM-style.
  const spells: { clubId: string; from: string; to: string; apps: number; goals: number }[] = []
  for (const r of rows) {
    const last = spells[spells.length - 1]
    if (last && last.clubId === r.clubId) {
      last.to = r.season
      last.apps += r.stats.apps
      last.goals += r.stats.goals
    } else spells.push({ clubId: r.clubId, from: r.season, to: r.season, apps: r.stats.apps, goals: r.stats.goals })
  }

  const cols: Column<PlayerSeason>[] = [
    { key: 'season', label: 'Season', align: 'left', render: (r) => <Link to={`/players/${player.id}?season=${r.season}`}>{r.season}</Link>, sortValue: (r) => r.season },
    { key: 'age', label: 'Age', align: 'right', render: (r) => r.age, sortValue: (r) => r.age },
    { key: 'club', label: 'Club', align: 'left', render: (r) => <span className="cell-club"><ClubBadge clubId={r.clubId} size={15} /> {getClub(r.clubId)?.name}</span>, sortValue: (r) => getClub(r.clubId)?.name ?? '' },
    { key: 'league', label: 'League', align: 'left', render: (r) => <Link to={`/leagues/${r.leagueId}`}>{getLeague(r.leagueId)?.name}</Link> },
    { key: 'apps', label: 'MP', title: 'Matches played', align: 'right', render: (r) => r.stats.apps, sortValue: (r) => r.stats.apps },
    { key: 'starts', label: 'Starts', align: 'right', render: (r) => r.stats.starts, sortValue: (r) => r.stats.starts },
    { key: 'mins', label: 'Min', title: 'Minutes', align: 'right', render: (r) => r.stats.mins.toLocaleString('en-GB'), sortValue: (r) => r.stats.mins },
    ...(isGK
      ? ([
          { key: 'ga', label: 'GA', title: 'Goals conceded', align: 'right', render: (r) => r.stats.goalsAgainst, sortValue: (r) => r.stats.goalsAgainst },
          { key: 'saves', label: 'Saves', align: 'right', render: (r) => r.stats.saves, sortValue: (r) => r.stats.saves },
          { key: 'savePct', label: 'Save%', align: 'right', render: (r) => formatMetric(METRIC.savePct, metricValue(METRIC.savePct, r.stats, false)), sortValue: (r) => metricValue(METRIC.savePct, r.stats, false) },
          ...(hasCS ? [{ key: 'cs', label: 'CS', title: 'Clean sheets', align: 'right', render: (r) => r.stats.cleanSheets, sortValue: (r) => r.stats.cleanSheets }] as Column<PlayerSeason>[] : []),
          ...(hasPsxg ? [{ key: 'psxgd', label: 'PSxG±', title: 'Goals prevented', align: 'right', render: (r) => (r.stats.psxg - r.stats.goalsAgainst).toFixed(1), sortValue: (r) => r.stats.psxg - r.stats.goalsAgainst }] as Column<PlayerSeason>[] : []),
        ] as Column<PlayerSeason>[])
      : ([
          { key: 'goals', label: 'Gls', title: 'Goals', align: 'right', render: (r) => r.stats.goals, sortValue: (r) => r.stats.goals },
          { key: 'assists', label: 'Ast', title: 'Assists', align: 'right', render: (r) => r.stats.assists, sortValue: (r) => r.stats.assists },
          ...(hasXg
            ? [
                { key: 'xg', label: 'xG', align: 'right', render: (r) => r.stats.xg.toFixed(1), sortValue: (r) => r.stats.xg },
                { key: 'xag', label: 'xAG', align: 'right', render: (r) => r.stats.xag.toFixed(1), sortValue: (r) => r.stats.xag },
              ] as Column<PlayerSeason>[]
            : []),
          { key: 'ga90', label: 'G+A/90', title: 'Goals plus assists per 90 minutes', align: 'right', render: (r) => p90(r.stats.goals + r.stats.assists, r.stats.mins), sortValue: (r) => (r.stats.goals + r.stats.assists) / Math.max(r.stats.mins, 1) },
          ...(hasXg ? [{ key: 'xgxag90', label: 'npxG+xAG/90', title: 'Expected goal involvement per 90', align: 'right', render: (r) => p90(r.stats.npxg + r.stats.xag, r.stats.mins), sortValue: (r) => (r.stats.npxg + r.stats.xag) / Math.max(r.stats.mins, 1) }] as Column<PlayerSeason>[] : []),
        ] as Column<PlayerSeason>[])),
    { key: 'cards', label: 'Cards', title: 'Yellow / red cards', align: 'right', render: (r) => `${r.stats.yellows} / ${r.stats.reds}` },
  ]

  const footer = (
    <tr className="total-row">
      <td>Total</td>
      <td />
      <td>{spells.length} club{spells.length === 1 ? '' : 's'}</td>
      <td />
      <td className="al-right num">{total.apps}</td>
      <td className="al-right num">{total.starts}</td>
      <td className="al-right num">{total.mins.toLocaleString('en-GB')}</td>
      {isGK ? (
        <>
          <td className="al-right num">{total.goalsAgainst}</td>
          <td className="al-right num">{total.saves}</td>
          <td className="al-right num">{total.sotAgainst ? `${((total.saves / total.sotAgainst) * 100).toFixed(1)}%` : '—'}</td>
          {hasCS && <td className="al-right num">{total.cleanSheets}</td>}
          {hasPsxg && <td className="al-right num">{(total.psxg - total.goalsAgainst).toFixed(1)}</td>}
        </>
      ) : (
        <>
          <td className="al-right num">{total.goals}</td>
          <td className="al-right num">{total.assists}</td>
          {hasXg && <td className="al-right num">{total.xg.toFixed(1)}</td>}
          {hasXg && <td className="al-right num">{total.xag.toFixed(1)}</td>}
          <td className="al-right num">{p90(total.goals + total.assists, total.mins)}</td>
          {hasXg && <td className="al-right num">{p90(total.npxg + total.xag, total.mins)}</td>}
        </>
      )}
      <td className="al-right num">{total.yellows} / {total.reds}</td>
    </tr>
  )

  return (
    <div className="career">
      <Panel title="League career" actions={<span className="panel-meta">{dataset.isSample ? 'Sample data · ' : ''}{rows.length} season{rows.length === 1 ? '' : 's'}</span>} flush>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.season + r.clubId} initialSort={{ key: 'season', dir: 'desc' }} footer={footer} />
      </Panel>
      <div className="career-bottom">
        <Panel title="Club history">
          <ol className="spells">
            {[...spells].reverse().map((s) => (
              <li key={s.clubId + s.from}>
                <ClubBadge clubId={s.clubId} size={26} />
                <div>
                  <div className="spell-club">{getClub(s.clubId)?.name}</div>
                  <div className="muted small">{s.from === s.to ? s.from : `${s.from} – ${s.to}`} · {getLeague(getClub(s.clubId)!.leagueId)?.name}</div>
                </div>
                <div className="spell-nums num">
                  <span>{s.apps}<small>MP</small></span>
                  {!isGK && <span>{s.goals}<small>Gls</small></span>}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Trends by season">
          <div className="trend-grid">
            <SeasonBars title="Minutes" items={rows.map((r) => ({ label: r.season, value: r.stats.mins }))} format={(v) => v.toLocaleString('en-GB')} />
            {isGK ? (
              <>
                <SeasonBars title="Save %" items={rows.map((r) => ({ label: r.season, value: (metricValue(METRIC.savePct, r.stats, false) ?? 0) * 100 }))} format={(v) => `${v.toFixed(1)}%`} />
                {hasCS && <SeasonBars title="Clean sheets" items={rows.map((r) => ({ label: r.season, value: r.stats.cleanSheets }))} format={(v) => String(v)} />}
              </>
            ) : (
              <>
                <SeasonBars title="Goals + assists" items={rows.map((r) => ({ label: r.season, value: r.stats.goals + r.stats.assists }))} format={(v) => String(v)} />
                {hasXg && <SeasonBars title="npxG + xAG per 90" items={rows.map((r) => ({ label: r.season, value: r.stats.mins ? (r.stats.npxg + r.stats.xag) / (r.stats.mins / 90) : 0 }))} format={(v) => v.toFixed(2)} />}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
