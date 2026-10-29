// Downloads the big-five leagues from PitchAPI (https://pitchapi.dev), seasons
// 2021/22 to the current one, and turns them into a season Dataset at
// data-cache/pitchapi/dataset.json (combined with other sources by
// `npm run data:build`).
//
//   PITCHAPI_API_KEY=pk_... npm run data:pitchapi
//
// Each finished match is reduced to per-player totals and cached in
// data-cache/pitchapi/matches/, so re-running only fetches new matches (the
// current season grows each time). PitchAPI has no request allowance, only a
// fair-use burst guard, so requests are paced and 429s wait for Retry-After.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GROUP_OF } from '../src/data/sample/generate.ts'
import { EMPTY_LINE } from '../src/data/statline.ts'
import type { Club, Dataset, League, Player, PlayerSeason, Position, StatKey, StatLine } from '../src/data/types.ts'

const API = 'https://api.pitchapi.dev/v1'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache', 'pitchapi')
const OUT = join(CACHE, 'dataset.json')
const WORKERS = 4
const GAP_MS = 250 // between one worker's requests

export const LEAGUES = [
  { id: 'l_4WFCIZ', name: 'Premier League', country: 'England', nationCode: 'ENG' },
  { id: 'l_0ErfuF', name: 'La Liga', country: 'Spain', nationCode: 'ESP' },
  { id: 'l_0ALvwF', name: 'Serie A', country: 'Italy', nationCode: 'ITA' },
  { id: 'l_1Isor4', name: 'Bundesliga', country: 'Germany', nationCode: 'GER' },
  { id: 'l_3FJFUl', name: 'Ligue 1', country: 'France', nationCode: 'FRA' },
]
export const SEASONS = ['2021/2022', '2022/2023', '2023/2024', '2024/2025', '2025/2026', '2026/2027']
export const seasonLabel = (s: string) => `${s.slice(0, 4)}-${s.slice(7, 9)}` // "2025/2026" → "2025-26"

/** What PitchAPI's per-match player stats measure. Everything else is left unmeasured. */
export const AVAILABLE: StatKey[] = [
  'apps', 'starts', 'mins', 'goals', 'assists', 'npg', 'pkGoals', 'pkAtt', 'xg', 'npxg', 'xag', 'shots', 'sot',
  'passCmp', 'passAtt', 'keyPasses', 'finalThirdPasses', 'crosses', 'touches', 'touchesBox', 'dribblesAtt',
  'dribblesSucc', 'dispossessed', 'tackles', 'interceptions', 'blocks', 'clearances', 'recoveries', 'aerialsWon',
  'aerialsLost', 'errors', 'fouls', 'fouled', 'yellows', 'reds', 'duels', 'duelsWon', 'ratingMins',
  'sotAgainst', 'saves', 'goalsAgainst', 'cleanSheets', 'psxg', 'crossesStopped', 'sweeperActions', 'launches',
]

// oxlint-disable-next-line no-explicit-any
type Json = any

const key = process.env.PITCHAPI_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get(path: string): Promise<Json> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { 'X-API-KEY': key! } })
    if (res.ok) return (await res.json()).data
    if (res.status === 404) return null
    if (res.status === 401) throw new Error('PitchAPI rejected the key (401). Check PITCHAPI_API_KEY.')
    if (attempt >= 6) throw new Error(`${path}: HTTP ${res.status}`)
    const wait = Number(res.headers.get('retry-after')) || 2 ** attempt
    await sleep(wait * 1000)
  }
}

// ---------------------------------------------------------------------------
// Positions. Starters carry a grid code: tens = line of the formation
// (1 keeper, 3 defence ... 11 attack), units = lane (2 right ... 8 left).
// Substitutes only carry 0 keeper, 1 defender, 2 midfielder, 3 forward.
// ---------------------------------------------------------------------------

export function positionFromCode(code: number | null | undefined, starter: boolean): Position | undefined {
  if (code == null) return undefined
  if (!starter) return (['GK', 'D (C)', 'M (C)', 'ST (C)'] as Position[])[code]
  const line = Math.floor(code / 10)
  const lane = code % 10
  const side = lane <= 2 ? 'R' : lane >= 8 ? 'L' : 'C'
  if (line <= 1) return 'GK'
  if (line <= 3) return side === 'R' ? 'D (R)' : side === 'L' ? 'D (L)' : 'D (C)'
  if (line <= 5) return side === 'R' ? 'WB (R)' : side === 'L' ? 'WB (L)' : 'DM'
  if (line === 6) return side === 'R' ? 'M (R)' : side === 'L' ? 'M (L)' : lane === 5 ? 'DM' : 'M (C)'
  if (line === 7) return side === 'R' ? 'M (R)' : side === 'L' ? 'M (L)' : 'M (C)'
  if (line <= 9) return lane <= 3 ? 'AM (R)' : lane >= 7 ? 'AM (L)' : 'AM (C)'
  // The front line: outside forwards of a front three are wingers.
  return lane <= 3 ? 'AM (R)' : lane >= 7 ? 'AM (L)' : 'ST (C)'
}

// ---------------------------------------------------------------------------
// One match → per-player totals
// ---------------------------------------------------------------------------

interface MatchPlayer {
  id: string
  name: string
  teamId: string
  /** Raw lineup position code and whether it is a starter's (mapped by `positionFromCode` at build time). */
  code?: number | null
  starter?: boolean
  position?: Position // older cache files only
  image?: string
  stats: Partial<StatLine>
}
interface MatchSummary {
  matchId: string
  leagueId: string
  season: string
  date: string
  home: { id: string; name: string; image?: string; stadium?: string }
  away: { id: string; name: string; image?: string }
  players: MatchPlayer[]
}

function statLine(groups: Json[]): Partial<StatLine> {
  const v: Record<string, Json> = {}
  for (const g of groups) for (const e of Object.values(g.stats) as Json[]) if (e.key) v[e.key] = e.stat
  const n = (k: string) => Number(v[k]?.value ?? 0) || 0
  const total = (k: string) => Number(v[k]?.total ?? 0) || 0
  const mins = n('minutes_played')
  const xg = n('expected_goals')
  return {
    mins,
    goals: n('goals'),
    assists: n('assists'),
    xg,
    npxg: v.expected_goals_non_penalty ? n('expected_goals_non_penalty') : xg,
    xag: n('expected_assists'),
    shots: n('total_shots'),
    sot: n('ShotsOnTarget'),
    passCmp: n('accurate_passes'),
    passAtt: total('accurate_passes'),
    keyPasses: n('chances_created'),
    finalThirdPasses: n('passes_into_final_third'),
    crosses: total('accurate_crosses'),
    touches: n('touches'),
    touchesBox: n('touches_opp_box'),
    dribblesAtt: total('dribbles_succeeded'),
    dribblesSucc: n('dribbles_succeeded'),
    dispossessed: n('dispossessed'),
    tackles: n('matchstats.headers.tackles'),
    interceptions: n('interceptions'),
    blocks: n('shot_blocks'),
    clearances: n('clearances'),
    recoveries: n('recoveries'),
    aerialsWon: n('aerials_won'),
    aerialsLost: total('aerials_won') - n('aerials_won'),
    errors: n('errors_led_to_goal'),
    fouls: n('fouls'),
    fouled: n('was_fouled'),
    duels: n('duel_won') + n('duel_lost'),
    duelsWon: n('duel_won'),
    ratingMins: n('rating_title') * mins,
    saves: n('saves'),
    goalsAgainst: n('goals_conceded'),
    psxg: n('expected_goals_on_target_faced'),
    crossesStopped: n('keeper_high_claim') + n('punches'),
    sweeperActions: n('keeper_sweeper'),
    launches: total('long_balls_accurate'),
  }
}

function lineupCodes(lineups: Json) {
  const codes = new Map<string, { code: number | null; starter: boolean }>()
  for (const side of ['home', 'away']) {
    for (const p of lineups?.[side]?.starters ?? []) codes.set(p.player_id, { code: p.position_id, starter: true })
    for (const p of lineups?.[side]?.subs ?? []) codes.set(p.player_id, { code: p.position_id, starter: false })
  }
  return codes
}

export function summarise(match: Json, players: Json[], lineups: Json, events: Json[]): MatchSummary {
  const position = lineupCodes(lineups)
  const out = new Map<string, MatchPlayer>()
  for (const p of players) {
    const stats = statLine(p.stats)
    if (!stats.mins) continue
    const lu = position.get(p.player.id)
    stats.apps = 1
    stats.starts = lu?.starter ? 1 : 0
    stats.yellows = 0
    stats.reds = 0
    stats.pkGoals = 0
    stats.pkAtt = 0
    stats.cleanSheets = 0
    out.set(p.player.id, { id: p.player.id, name: p.player.name, teamId: p.team_id, code: lu?.code, starter: lu?.starter ?? false, image: p.player.image_url, stats })
  }
  for (const e of events ?? []) {
    const s = e.player ? out.get(e.player.id)?.stats : undefined
    if (!s) continue
    const type = String(e.event_type).toLowerCase()
    if (type === 'yellowcard') s.yellows!++
    else if (type === 'redcard' || type === 'yellowred' || type === 'secondyellow') s.reds!++
    else if (type === 'goal' && e.is_penalty && !e.is_own_goal) {
      s.pkGoals!++
      s.pkAtt!++
    } else if (type.includes('penalty') && type.includes('miss')) s.pkAtt!++
  }
  for (const p of out.values()) {
    const s = p.stats
    s.npg = Math.max(0, s.goals! - s.pkGoals!)
    s.sotAgainst = s.saves! + s.goalsAgainst!
    const conceded = p.teamId === match.home_team.id ? match.score_away : match.score_home
    if (positionFromCode(p.code, !!p.starter) === 'GK' && s.starts && conceded === 0) s.cleanSheets = 1
  }
  return {
    matchId: match.id,
    leagueId: match.league?.id,
    season: match.season,
    date: match.date,
    home: { id: match.home_team.id, name: match.home_team.name, image: match.home_team.image_url, stadium: match.stadium ?? undefined },
    away: { id: match.away_team.id, name: match.away_team.name, image: match.away_team.image_url },
    players: [...out.values()],
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function download() {
  if (!key) throw new Error('PITCHAPI_API_KEY is not set.')
  mkdirSync(join(CACHE, 'matches'), { recursive: true })
  mkdirSync(join(CACHE, 'players'), { recursive: true })
  const current = SEASONS[SEASONS.length - 1]
  for (const season of SEASONS) {
    for (const league of LEAGUES) {
      // Finished seasons' fixture lists never change; the current one is fetched fresh each run.
      const listFile = join(CACHE, `list-${league.id}-${season.replace('/', '-')}.json`)
      const list: Json[] = season !== current && existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : ((await get(`/leagues/${league.id}/matches?season=${season}`))?.matches ?? [])
      writeFileSync(listFile, JSON.stringify(list))
      const todo = list.filter((m) => m.status === 'finished' && !existsSync(join(CACHE, 'matches', `${m.id}.json`)))
      console.log(`${league.name} ${season}: ${list.length} matches, ${todo.length} to download`)
      const worker = async () => {
        for (let m = todo.shift(); m; m = todo.shift()) {
          const match = await get(`/matches/${m.id}`)
          await sleep(GAP_MS)
          const players = await get(`/matches/${m.id}/players`)
          await sleep(GAP_MS)
          const lineups = await get(`/matches/${m.id}/lineups`)
          await sleep(GAP_MS)
          const events = (await get(`/matches/${m.id}/events`))?.events
          await sleep(GAP_MS)
          if (!match || !players) continue
          writeFileSync(join(CACHE, 'matches', `${m.id}.json`), JSON.stringify(summarise(match, players, lineups, events)))
        }
      }
      await Promise.all(Array.from({ length: WORKERS }, worker))
    }
  }

  // Matches cached before position codes were kept: fetch their lineups again (one request each).
  const old = readdirSync(join(CACHE, 'matches')).filter((f) => {
    const m: MatchSummary = JSON.parse(readFileSync(join(CACHE, 'matches', f), 'utf8'))
    return m.players.some((p) => p.code === undefined)
  })
  if (old.length) console.log(`Refreshing positions for ${old.length} earlier matches`)
  const fixer = async () => {
    for (let f = old.shift(); f; f = old.shift()) {
      const file = join(CACHE, 'matches', f)
      const m: MatchSummary = JSON.parse(readFileSync(file, 'utf8'))
      const codes = lineupCodes(await get(`/matches/${m.matchId}/lineups`))
      for (const p of m.players) {
        p.code = codes.get(p.id)?.code ?? null
        p.starter = codes.get(p.id)?.starter ?? !!p.stats.starts
        delete p.position
      }
      writeFileSync(file, JSON.stringify(m))
      await sleep(GAP_MS)
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, fixer))

  // Player profiles, for nationality.
  const ids = new Set<string>()
  for (const f of readdirSync(join(CACHE, 'matches'))) for (const p of JSON.parse(readFileSync(join(CACHE, 'matches', f), 'utf8')).players) ids.add(p.id)
  const missing = [...ids].filter((id) => !existsSync(join(CACHE, 'players', `${id}.json`)))
  console.log(`Player profiles: ${ids.size}, ${missing.length} to download`)
  const worker = async () => {
    for (let id = missing.shift(); id; id = missing.shift()) {
      const profile = await get(`/players/${id}`)
      if (profile) writeFileSync(join(CACHE, 'players', `${id}.json`), JSON.stringify(profile))
      await sleep(GAP_MS)
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))
}

// ---------------------------------------------------------------------------
// Season dataset
// ---------------------------------------------------------------------------

function build() {
  const summaries: MatchSummary[] = readdirSync(join(CACHE, 'matches')).map((f) => JSON.parse(readFileSync(join(CACHE, 'matches', f), 'utf8')))
  summaries.sort((a, b) => a.date.localeCompare(b.date))

  const leagues: League[] = []
  const clubs = new Map<string, Club>()
  const stadiums = new Map<string, Map<string, number>>()
  const clubImages: Record<string, string> = {}
  const playerImages: Record<string, string> = {}
  const rows = new Map<string, PlayerSeason>()
  const people = new Map<string, { name: string; teamId: string; positions: Partial<Record<Position, number>> }>()

  for (const l of LEAGUES) {
    const teams = new Set(summaries.filter((m) => m.leagueId === l.id && m.season === SEASONS[SEASONS.length - 2]).flatMap((m) => [m.home.id, m.away.id]))
    leagues.push({ id: l.id, name: l.name, country: l.country, nationCode: l.nationCode, matchesPerSeason: Math.max(1, teams.size - 1) * 2 })
  }

  for (const m of summaries) {
    const season = seasonLabel(m.season)
    for (const t of [m.home, m.away]) {
      // A club's league is the one it played in most recently.
      clubs.set(t.id, { id: t.id, name: t.name, shortName: t.name, abbr: t.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), leagueId: m.leagueId, colors: ['#5b6573', '#c9ced6'] })
      if (t.image) clubImages[t.id] = t.image
    }
    if (m.home.stadium) {
      const tally = stadiums.get(m.home.id) ?? new Map<string, number>()
      tally.set(m.home.stadium, (tally.get(m.home.stadium) ?? 0) + 1)
      stadiums.set(m.home.id, tally)
    }
    for (const p of m.players) {
      const k = `${p.id}|${season}|${p.teamId}`
      const row = rows.get(k) ?? { playerId: p.id, season, clubId: p.teamId, leagueId: m.leagueId, stats: { ...EMPTY_LINE } }
      for (const [stat, v] of Object.entries(p.stats) as [StatKey, number][]) row.stats[stat] += v
      rows.set(k, row)
      const person = people.get(p.id) ?? { name: p.name, teamId: p.teamId, positions: {} }
      person.name = p.name
      person.teamId = p.teamId
      const pos = p.code !== undefined ? positionFromCode(p.code, !!p.starter) : p.position
      if (pos) person.positions[pos] = (person.positions[pos] ?? 0) + (p.stats.mins ?? 0) * (p.starter ? 1 : 0.5)
      people.set(p.id, person)
      if (p.image) playerImages[p.id] = p.image
    }
  }
  for (const [id, tally] of stadiums) {
    const club = clubs.get(id)
    if (club) club.stadium = [...tally].sort((a, b) => b[1] - a[1])[0][0]
  }
  for (const row of rows.values()) for (const k of ['xg', 'npxg', 'xag', 'psxg', 'ratingMins'] as const) row.stats[k] = Math.round(row.stats[k] * 100) / 100

  const players: Player[] = [...people.entries()].map(([id, p]) => {
    const profile = existsSync(join(CACHE, 'players', `${id}.json`)) ? JSON.parse(readFileSync(join(CACHE, 'players', `${id}.json`), 'utf8')) : null
    const ranked = (Object.entries(p.positions) as [Position, number][]).sort((a, b) => b[1] - a[1])
    const primary = ranked[0]?.[0] ?? 'M (C)'
    const words = p.name.split(' ')
    return {
      id,
      name: p.name,
      firstName: words.length > 1 ? words.slice(0, -1).join(' ') : '',
      lastName: words[words.length - 1],
      nationCode: profile?.country_code ?? 'UNK',
      heightCm: 0,
      primaryPosition: primary,
      secondaryPositions: ranked.slice(1).filter(([, mins]) => mins >= 270).map(([pos]) => pos),
      group: GROUP_OF[primary],
      clubId: p.teamId,
      shirtNumber: profile?.shirt_number ? Number(profile.shirt_number) : undefined,
    }
  })

  const seasons = [...new Set([...rows.values()].map((r) => r.season))].sort()
  const dataset: Dataset & { images: { clubs: Record<string, string>; players: Record<string, string> } } = {
    isSample: false,
    sourceName: 'PitchAPI',
    availableStats: AVAILABLE,
    seasons,
    currentSeason: seasons[seasons.length - 1],
    nations: [],
    leagues,
    clubs: [...clubs.values()],
    players,
    playerSeasons: [...rows.values()],
    images: { clubs: clubImages, players: playerImages },
  }
  writeFileSync(OUT, JSON.stringify(dataset))
  const counts = seasons.map((s) => `${s}: ${new Set([...rows.values()].filter((r) => r.season === s).map((r) => r.playerId)).size} players`)
  console.log(`${summaries.length} matches → ${players.length} players\n  ${counts.join('\n  ')}\nWrote ${OUT}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ;(process.argv.includes('--build-only') ? Promise.resolve() : download()).then(build).catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
