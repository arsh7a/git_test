import { METRIC, METRICS, RADAR_TEMPLATES, SCOUT_TEMPLATE_GK, SCOUT_TEMPLATE_OUTFIELD, metricValue } from './metrics'
import { dataset } from './source'
import type { Club, League, Nation, Player, PlayerSeason, PositionGroup, StatLine } from './types'

// ---------------------------------------------------------------------------
// The single entry point for football data. Every page reads data through
// this file; `./source` decides whether that is real or sample data.
// ---------------------------------------------------------------------------

export { dataset }

/** Players need this many minutes in a season to be part of percentile pools. */
export const MIN_MINUTES = 900

const playerById = new Map(dataset.players.map((p) => [p.id, p]))
const clubById = new Map(dataset.clubs.map((c) => [c.id, c]))
const leagueById = new Map(dataset.leagues.map((l) => [l.id, l]))
const nationByCode = new Map(dataset.nations.map((n) => [n.code, n]))

const seasonsByPlayer = new Map<string, PlayerSeason[]>()
for (const row of dataset.playerSeasons) {
  if (!seasonsByPlayer.has(row.playerId)) seasonsByPlayer.set(row.playerId, [])
  seasonsByPlayer.get(row.playerId)!.push(row)
}
for (const rows of seasonsByPlayer.values()) rows.sort((a, b) => a.season.localeCompare(b.season))

export const getPlayer = (id: string): Player | undefined => playerById.get(id)
export const getClub = (id: string): Club | undefined => clubById.get(id)
export const getLeague = (id: string): League | undefined => leagueById.get(id)
export const getNation = (code: string): Nation | undefined => nationByCode.get(code)

/** All season rows for a player, oldest first. */
export const getPlayerSeasons = (id: string): PlayerSeason[] => seasonsByPlayer.get(id) ?? []

/** One player's season. Sums rows if a player had more than one club that season. */
export function getPlayerSeason(id: string, season: string): PlayerSeason | undefined {
  const rows = getPlayerSeasons(id).filter((r) => r.season === season)
  if (rows.length <= 1) return rows[0]
  const stats = { ...rows[0].stats }
  for (const r of rows.slice(1)) {
    for (const k of Object.keys(stats) as (keyof StatLine)[]) stats[k] += r.stats[k]
  }
  const last = rows[rows.length - 1]
  return { ...last, stats }
}

/** The season to show first on a profile: the current one, or the latest they played. */
export function defaultSeasonFor(id: string): string {
  const rows = getPlayerSeasons(id)
  if (rows.some((r) => r.season === dataset.currentSeason)) return dataset.currentSeason
  return rows.length ? rows[rows.length - 1].season : dataset.currentSeason
}

export function ageOn(birthDate: string, on: Date = new Date()): number {
  const b = new Date(birthDate + 'T00:00:00')
  let age = on.getFullYear() - b.getFullYear()
  const m = on.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--
  return age
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const searchIndex = dataset.players.map((p) => ({
  p,
  name: normalize(p.name),
  last: normalize(p.lastName),
  club: normalize(clubById.get(p.clubId)?.name ?? ''),
}))

/** Find players by name (accents ignored) or club name. */
export function searchPlayers(query: string, limit = 8): Player[] {
  const q = normalize(query.trim())
  if (!q) return []
  const scored: { p: Player; score: number; mins: number }[] = []
  for (const e of searchIndex) {
    let score = 0
    if (e.name.startsWith(q) || e.last.startsWith(q)) score = 3
    else if (e.name.includes(q)) score = 2
    else if (e.club.includes(q)) score = 1
    if (score) scored.push({ p: e.p, score, mins: getPlayerSeason(e.p.id, dataset.currentSeason)?.stats.mins ?? 0 })
  }
  scored.sort((a, b) => b.score - a.score || b.mins - a.mins)
  return scored.slice(0, limit).map((s) => s.p)
}

// ---------------------------------------------------------------------------
// Season tables
// ---------------------------------------------------------------------------

export interface SeasonRow {
  player: Player
  club: Club
  league: League
  season: string
  age: number
  stats: StatLine
}

const seasonRowCache = new Map<string, SeasonRow[]>()

/** One row per player who played in the season. */
export function getSeasonRows(season: string): SeasonRow[] {
  const cached = seasonRowCache.get(season)
  if (cached) return cached
  const rows: SeasonRow[] = []
  for (const player of dataset.players) {
    const ps = getPlayerSeason(player.id, season)
    if (!ps) continue
    rows.push({
      player,
      club: clubById.get(ps.clubId)!,
      league: leagueById.get(ps.leagueId)!,
      season,
      age: ps.age,
      stats: ps.stats,
    })
  }
  seasonRowCache.set(season, rows)
  return rows
}

// ---------------------------------------------------------------------------
// Percentiles: how a player ranks against others in the same position group
// ---------------------------------------------------------------------------

const poolCache = new Map<string, number[]>()

function poolValues(season: string, group: PositionGroup, metricId: string): number[] {
  const key = `${season}|${group}|${metricId}`
  const cached = poolCache.get(key)
  if (cached) return cached
  const m = METRIC[metricId]
  const values: number[] = []
  for (const r of getSeasonRows(season)) {
    if (r.player.group !== group || r.stats.mins < MIN_MINUTES) continue
    const v = metricValue(m, r.stats, m.per90)
    if (v != null) values.push(v)
  }
  values.sort((a, b) => a - b)
  poolCache.set(key, values)
  return values
}

export function poolSize(season: string, group: PositionGroup): number {
  return getSeasonRows(season).filter((r) => r.player.group === group && r.stats.mins >= MIN_MINUTES).length
}

/** 0–100: the share of position peers this player outperforms on a stat. */
export function percentile(metricId: string, stats: StatLine, season: string, group: PositionGroup): number | null {
  const m = METRIC[metricId]
  const v = metricValue(m, stats, m.per90)
  if (v == null) return null
  const arr = poolValues(season, group, metricId)
  if (arr.length < 5) return null
  let below = 0
  let equal = 0
  for (const x of arr) {
    if (x < v - 1e-9) below++
    else if (Math.abs(x - v) <= 1e-9) equal++
  }
  let p = ((below + 0.5 * equal) / arr.length) * 100
  if (m.lowerIsBetter) p = 100 - p
  return Math.round(Math.min(100, Math.max(0, p)))
}

export interface PercentileItem {
  metricId: string
  value: number | null
  pct: number | null
}

export function percentileItems(metricIds: string[], stats: StatLine, season: string, group: PositionGroup): PercentileItem[] {
  return metricIds.map((id) => ({
    metricId: id,
    value: metricValue(METRIC[id], stats, METRIC[id].per90),
    pct: percentile(id, stats, season, group),
  }))
}

export const scoutTemplate = (group: PositionGroup) => (group === 'GK' ? SCOUT_TEMPLATE_GK : SCOUT_TEMPLATE_OUTFIELD)

const NOT_A_STRENGTH = new Set(['launchPct', 'touches', 'passCmp'])

/** The player's best and worst stats relative to position peers. */
export function strengthsAndWeaknesses(stats: StatLine, season: string, group: PositionGroup) {
  const ids = Array.from(new Set([...scoutTemplate(group).flatMap((c) => c.metrics), ...RADAR_TEMPLATES[group]])).filter(
    (id) => !NOT_A_STRENGTH.has(id),
  )
  const items = percentileItems(ids, stats, season, group).filter((i) => i.pct != null) as (PercentileItem & { pct: number })[]
  const strengths = items.filter((i) => i.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 5)
  const weaknesses = items.filter((i) => i.pct <= 25).sort((a, b) => a.pct - b.pct).slice(0, 4)
  return { strengths, weaknesses }
}

/** Players whose percentile profile looks most like this one. */
export function similarPlayers(playerId: string, season: string, limit = 5) {
  const player = playerById.get(playerId)
  const own = getPlayerSeason(playerId, season)
  if (!player || !own) return []
  const ids = RADAR_TEMPLATES[player.group]
  const vec = (s: StatLine) => ids.map((id) => percentile(id, s, season, player.group) ?? 50)
  const mine = vec(own.stats)
  const results: { row: SeasonRow; similarity: number }[] = []
  for (const r of getSeasonRows(season)) {
    if (r.player.id === playerId || r.player.group !== player.group || r.stats.mins < MIN_MINUTES) continue
    const v = vec(r.stats)
    const rms = Math.sqrt(v.reduce((acc, x, i) => acc + (x - mine[i]) ** 2, 0) / v.length)
    results.push({ row: r, similarity: Math.max(0, Math.round(100 - rms)) })
  }
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Leagues & clubs
// ---------------------------------------------------------------------------

export const clubsInLeague = (leagueId: string) => dataset.clubs.filter((c) => c.leagueId === leagueId)
export const currentSquad = (clubId: string) => dataset.players.filter((p) => p.clubId === clubId)

export function leaders(
  season: string,
  metricId: string,
  opts: { leagueId?: string; per90?: boolean; minMins?: number; groups?: PositionGroup[]; limit?: number } = {},
) {
  const m = METRIC[metricId]
  if (!m) return [] // not measured by this data source
  const rows = getSeasonRows(season).filter(
    (r) =>
      (!opts.leagueId || r.league.id === opts.leagueId) &&
      r.stats.mins >= (opts.minMins ?? 0) &&
      (!opts.groups || opts.groups.includes(r.player.group)),
  )
  return rows
    .map((r) => ({ row: r, value: metricValue(m, r.stats, !!opts.per90) }))
    .filter((x): x is { row: SeasonRow; value: number } => x.value != null)
    .sort((a, b) => (m.lowerIsBetter ? a.value - b.value : b.value - a.value))
    .slice(0, opts.limit ?? 5)
}

export interface ClubSeasonSummary {
  club: Club
  playersUsed: number
  goals: number
  xg: number
  goalsAgainst: number
  xga: number
  avgAge: number
}

/** Team totals built by adding up the players' sample stats. */
export function clubSummaries(leagueId: string, season: string): ClubSeasonSummary[] {
  const rows = getSeasonRows(season).filter((r) => r.league.id === leagueId)
  return clubsInLeague(leagueId).map((club) => {
    const mine = rows.filter((r) => r.club.id === club.id)
    const totalMins = mine.reduce((a, r) => a + r.stats.mins, 0) || 1
    return {
      club,
      playersUsed: mine.length,
      goals: mine.reduce((a, r) => a + r.stats.goals, 0),
      xg: mine.reduce((a, r) => a + r.stats.xg, 0),
      goalsAgainst: mine.reduce((a, r) => a + r.stats.goalsAgainst, 0),
      xga: mine.reduce((a, r) => a + r.stats.psxg, 0),
      avgAge: mine.reduce((a, r) => a + r.age * r.stats.mins, 0) / totalMins,
    }
  })
}

export { METRIC, METRICS }
