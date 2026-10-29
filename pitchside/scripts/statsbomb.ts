// Builds the site's data from StatsBomb Open Data (2015/16 season).
//
//   npm run data:statsbomb
//
// 1. Downloads each match's events and lineups from github.com/statsbomb/open-data
//    and reduces them to per-player totals, saved one small file per match in
//    data-cache/statsbomb/ (raw events, ~3 MB a match, are not kept). Re-running
//    skips matches already done, so it is safe to stop and restart.
// 2. Adds the matches up into a season Dataset at src/data/real/dataset.json.
//
// Neither folder is committed: StatsBomb's user agreement does not allow the
// data to be redistributed. Anything published from it must credit StatsBomb
// with their logo.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GROUP_OF } from '../src/data/sample/generate.ts'
import { NATIONS } from '../src/data/sample/nations.ts'
import { EMPTY_LINE, STAT_KEYS } from '../src/data/statline.ts'
import type { WikidataMatches } from './wikidata.ts'
import type { Club, Dataset, League, Nation, Player, PlayerSeason, Position, StatKey, StatLine } from '../src/data/types.ts'

const RAW = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache', 'statsbomb')
const OUT = join(ROOT, 'src', 'data', 'real', 'dataset.json')

const SEASON_ID = 27 // 2015/2016
const SEASON = '2015-16'
// Full seasons in the open data. (Bundesliga 2015/16 is left out: it only has Leverkusen's 34 matches.)
const COMPETITIONS = [
  { id: 2, name: 'Premier League', country: 'England' },
  { id: 11, name: 'La Liga', country: 'Spain' },
  { id: 12, name: 'Serie A', country: 'Italy' },
  { id: 7, name: 'Ligue 1', country: 'France' },
]
const CONCURRENCY = 6
// StatsBomb's logo, which their user agreement requires next to anything published from the data.
const LOGO = 'https://raw.githubusercontent.com/statsbomb/open-data/master/img/SB%20-%20Icon%20Lockup%20-%20Colour%20positive.png'

/** StatsBomb measures everything the site uses except match ratings and post-shot xG. */
const AVAILABLE: StatKey[] = STAT_KEYS.filter((k) => k !== 'ratingMins' && k !== 'psxg')

const POSITION: Record<string, Position> = {
  Goalkeeper: 'GK',
  'Right Back': 'D (R)', 'Left Back': 'D (L)',
  'Right Center Back': 'D (C)', 'Center Back': 'D (C)', 'Left Center Back': 'D (C)',
  'Right Wing Back': 'WB (R)', 'Left Wing Back': 'WB (L)',
  'Right Defensive Midfield': 'DM', 'Center Defensive Midfield': 'DM', 'Left Defensive Midfield': 'DM',
  'Right Center Midfield': 'M (C)', 'Center Midfield': 'M (C)', 'Left Center Midfield': 'M (C)',
  'Right Midfield': 'M (R)', 'Left Midfield': 'M (L)',
  'Right Attacking Midfield': 'AM (C)', 'Center Attacking Midfield': 'AM (C)', 'Left Attacking Midfield': 'AM (C)',
  'Right Wing': 'AM (R)', 'Left Wing': 'AM (L)',
  'Right Center Forward': 'ST (C)', 'Striker': 'ST (C)', 'Center Forward': 'ST (C)', 'Left Center Forward': 'ST (C)',
  'Secondary Striker': 'ST (C)',
}

// oxlint-disable-next-line no-explicit-any
type Json = any

/** One player's contribution to one match. */
interface MatchPlayer {
  id: number
  name: string
  fullName: string
  country: string | null
  jersey: number
  teamId: number
  positionMins: Partial<Record<Position, number>>
  stats: StatLine
}
interface MatchSummary {
  matchId: number
  competitionId: number
  date: string
  home: { id: number; name: string; stadium: string | null }
  away: { id: number; name: string }
  players: MatchPlayer[]
}

async function getJson(url: string): Promise<Json> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url}: ${e instanceof Error ? e.message : e}`)
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)))
    }
  }
}

// ---------------------------------------------------------------------------
// One match → per-player totals
// ---------------------------------------------------------------------------

const clock = (mmss: string) => {
  const [m, s] = mmss.split(':').map(Number)
  return m * 60 + s
}
const PERIOD_START = [0, 0, 45 * 60, 90 * 60, 105 * 60] // game clock at the start of each period
const inBox = (loc?: number[]) => !!loc && loc[0] >= 102 && loc[1] >= 18 && loc[1] <= 62
const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '')
const SET_PIECE_PASSES = new Set(['corner', 'free kick', 'throw-in', 'goal kick', 'kick off'])

export function summariseMatch(match: Json, competitionId: number, events: Json[], lineups: Json[]): MatchSummary {
  // The game clock restarts at 45:00 for the second half, so convert clock time into time played.
  const periodEnd: number[] = []
  for (const e of events) {
    if (e.type.name === 'Half End') periodEnd[e.period] = Math.max(periodEnd[e.period] ?? 0, e.minute * 60 + e.second)
  }
  const periods = Object.keys(periodEnd).map(Number).filter((p) => p <= 4)
  const periodLen = (p: number) => Math.max(0, (periodEnd[p] ?? PERIOD_START[p]) - PERIOD_START[p])
  const played = (t: number, period: number) => {
    let total = 0
    for (let q = 1; q < period; q++) total += periodLen(q)
    return total + Math.max(0, t - PERIOD_START[period])
  }
  const matchLength = periods.reduce((a, p) => a + periodLen(p), 0) || 90 * 60
  const eventTime = (e: Json) => played(e.minute * 60 + e.second, e.period)

  // Time on the pitch comes from the events (Starting XI, substitutions, red cards);
  // the lineup file's period markers are not reliable enough for this.
  const span = new Map<number, [number, number]>()
  for (const e of events) {
    const t = eventTime(e)
    if (e.type.name === 'Starting XI') for (const p of e.tactics.lineup) span.set(p.player.id, [0, matchLength])
    if (e.type.name === 'Substitution') {
      const off = span.get(e.player.id)
      if (off) off[1] = t
      span.set(e.substitution.replacement.id, [t, matchLength])
    }
    const card = lower((e.foul_committed ?? e.bad_behaviour)?.card?.name)
    if ((card === 'red card' || card === 'second yellow') && span.get(e.player?.id)) span.get(e.player.id)![1] = t
  }

  const players = new Map<number, MatchPlayer>()
  const onPitch = new Map<number, [number, number]>()
  for (const team of lineups) {
    for (const p of team.lineup) {
      const on = span.get(p.player_id)
      if (!on) continue
      const mp: MatchPlayer = {
        id: p.player_id,
        name: p.player_nickname ?? p.player_name,
        fullName: p.player_name,
        country: p.country?.name ?? null,
        jersey: p.jersey_number,
        teamId: team.team_id,
        positionMins: {},
        stats: { ...EMPTY_LINE },
      }
      // Minutes are scaled so a full match counts as 90, as on most stats sites.
      const mins = (Math.max(0, on[1] - on[0]) / matchLength) * 90
      mp.stats.mins = Math.round(mins)
      mp.stats.apps = 1
      mp.stats.starts = on[0] === 0 ? 1 : 0
      // Split those minutes across the positions listed in the lineup, by game-clock duration.
      const parts = (p.positions as Json[]).map((pos) => ({ site: POSITION[pos.position] ?? ('M (C)' as Position), secs: Math.max(1, (pos.to ? clock(pos.to) : 95 * 60) - clock(pos.from)) }))
      const totalSecs = parts.reduce((a, x) => a + x.secs, 0) || 1
      for (const x of parts) mp.positionMins[x.site] = (mp.positionMins[x.site] ?? 0) + (mins * x.secs) / totalSecs
      players.set(mp.id, mp)
      onPitch.set(mp.id, on)
    }
  }

  const s = (e: Json): StatLine | undefined => (e.player ? players.get(e.player.id)?.stats : undefined)
  const touch = (line: StatLine, loc?: number[]) => {
    line.touches++
    if (inBox(loc)) line.touchesBox++
  }
  const keeperAt = (teamId: number, t: number) => {
    for (const p of players.values()) {
      if (p.teamId !== teamId || !Object.keys(p.positionMins).includes('GK')) continue
      const [a, b] = onPitch.get(p.id)!
      if (t >= a && t < b) return p.stats
    }
    return undefined
  }

  const shotXg = new Map<string, number>()
  for (const e of events) if (e.type.name === 'Shot') shotXg.set(e.id, e.shot.statsbomb_xg ?? 0)
  const dribbledPast = new Map<StatLine, number>()
  const ownGoals = new Map<StatLine, number>()

  // Attacking actions per possession, for shot- and goal-creating actions.
  const possessionActions = new Map<number, { line: StatLine; teamId: number }[]>()
  const addAction = (e: Json, line: StatLine) => {
    if (!possessionActions.has(e.possession)) possessionActions.set(e.possession, [])
    possessionActions.get(e.possession)!.push({ line, teamId: e.team.id })
  }

  for (const e of events) {
    const line = s(e)
    if (!line) continue
    const type = e.type.name as string
    if (e[lower(type).replace(/ /g, '_')]?.aerial_won) line.aerialsWon++

    switch (type) {
      case 'Shot': {
        const sh = e.shot
        const xg = sh.statsbomb_xg ?? 0
        const outcome = lower(sh.outcome?.name)
        const goal = outcome === 'goal'
        const penalty = lower(sh.type?.name) === 'penalty'
        line.xg += xg
        if (goal) line.goals++
        if (penalty) {
          line.pkAtt++
          if (goal) line.pkGoals++
        } else {
          line.npxg += xg
          line.shots++
          if (goal || outcome === 'saved' || outcome === 'saved to post') line.sot++
          if (goal) line.npg++
        }
        if (lower(sh.type?.name) !== 'open play') touch(line, e.location)
        // The two attacking actions before this shot in the same possession.
        const before = (possessionActions.get(e.possession) ?? []).filter((a) => a.teamId === e.team.id).slice(-2)
        for (const a of before) {
          a.line.sca++
          if (goal) a.line.gca++
        }
        addAction(e, line)
        break
      }
      case 'Pass': {
        const p = e.pass
        const done = !p.outcome
        const start = e.location as number[]
        const end = p.end_location as number[]
        const kind = lower(p.type?.name)
        line.passAtt++
        if ((p.length ?? 0) >= 40) line.launches++
        if (SET_PIECE_PASSES.has(kind)) touch(line, start)
        if (p.cross) line.crosses++
        if (p.shot_assist || p.goal_assist) line.keyPasses++
        if (p.goal_assist) line.assists++
        if (p.assisted_shot_id) line.xag += shotXg.get(p.assisted_shot_id) ?? 0
        if (p.cross && inBox(end)) {
          const opp = e.team.id === match.home_team.home_team_id ? match.away_team.away_team_id : match.home_team.home_team_id
          const gk = keeperAt(opp, eventTime(e))
          if (gk) gk.crossesFaced++
        }
        if (!done) break
        line.passCmp++
        addAction(e, line)
        if (start[0] < 80 && end[0] >= 80) line.finalThirdPasses++
        // Progressive: from outside the defending 40%, at least 10 yards forward or into the box.
        if (start[0] >= 48 && kind !== 'corner' && kind !== 'throw-in' && (end[0] - start[0] >= 10 || (inBox(end) && !inBox(start)))) {
          line.progPasses++
          const to = p.recipient ? players.get(p.recipient.id)?.stats : undefined
          if (to) to.progRec++
        }
        break
      }
      case 'Ball Receipt*':
        if (!e.ball_receipt?.outcome) touch(line, e.location)
        break
      case 'Carry': {
        const start = e.location as number[]
        const end = e.carry.end_location as number[]
        if (end[0] - start[0] >= 10 && end[0] >= 60) line.progCarries++
        break
      }
      case 'Dribble':
        line.dribblesAtt++
        if (lower(e.dribble?.outcome?.name) === 'complete') {
          line.dribblesSucc++
          addAction(e, line)
        }
        break
      case 'Dribbled Past':
        dribbledPast.set(line, (dribbledPast.get(line) ?? 0) + 1)
        break
      case 'Dispossessed':
        line.dispossessed++
        break
      case 'Duel': {
        const kind = lower(e.duel?.type?.name)
        if (kind === 'tackle') {
          line.tackles++
          if (['won', 'success', 'success in play', 'success out'].includes(lower(e.duel?.outcome?.name))) line.tacklesWon++
        } else if (kind === 'aerial lost') line.aerialsLost++
        break
      }
      case 'Interception':
        line.interceptions++
        if (lower(e.interception?.outcome?.name).startsWith('success') || lower(e.interception?.outcome?.name) === 'won') touch(line, e.location)
        break
      case 'Block':
        line.blocks++
        break
      case 'Clearance':
        line.clearances++
        touch(line, e.location)
        break
      case 'Ball Recovery':
        if (!e.ball_recovery?.recovery_failure) {
          line.recoveries++
          touch(line, e.location)
        }
        break
      case 'Error':
        line.errors++
        break
      case 'Own Goal Against': {
        // Own goals count in a keeper's goals conceded (but not as a shot on target faced).
        const gk = keeperAt(e.team.id, eventTime(e))
        if (gk) ownGoals.set(gk, (ownGoals.get(gk) ?? 0) + 1)
        break
      }
      case 'Foul Won':
        line.fouled++
        addAction(e, line)
        break
      case 'Foul Committed':
      case 'Bad Behaviour': {
        line.fouls += type === 'Foul Committed' ? 1 : 0
        const card = lower((e.foul_committed ?? e.bad_behaviour)?.card?.name)
        if (card === 'yellow card') line.yellows++
        else if (card === 'second yellow' || card === 'red card') line.reds++
        break
      }
      case 'Goal Keeper': {
        const kind = lower(e.goalkeeper?.type?.name)
        if (kind === 'goal conceded' || kind === 'penalty conceded') line.goalsAgainst++
        else if (['shot saved', 'penalty saved', 'shot saved to post', 'saved to post'].includes(kind)) line.saves++
        else if (kind === 'keeper sweeper') line.sweeperActions++
        else if (kind === 'collected' || kind === 'punch') {
          line.crossesStopped++
          touch(line, e.location)
        }
        break
      }
    }
  }

  const homeId = match.home_team.home_team_id
  for (const p of players.values()) {
    const st = p.stats
    st.sotAgainst = st.saves + st.goalsAgainst
    st.goalsAgainst += ownGoals.get(st) ?? 0
    st.duels = st.tackles + st.dribblesAtt + st.aerialsWon + st.aerialsLost + (dribbledPast.get(st) ?? 0)
    st.duelsWon = st.tacklesWon + st.dribblesSucc + st.aerialsWon
    const conceded = p.teamId === homeId ? match.away_score : match.home_score
    if (st.starts && conceded === 0 && p.positionMins.GK) st.cleanSheets = 1
  }

  return {
    matchId: match.match_id,
    competitionId,
    date: match.match_date,
    home: { id: homeId, name: match.home_team.home_team_name, stadium: match.stadium?.name ?? null },
    away: { id: match.away_team.away_team_id, name: match.away_team.away_team_name },
    players: [...players.values()],
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function download() {
  mkdirSync(join(CACHE, 'matches'), { recursive: true })
  const logo = join(CACHE, 'logo.png')
  if (!existsSync(logo)) {
    const res = await fetch(LOGO)
    if (res.ok) writeFileSync(logo, Buffer.from(await res.arrayBuffer()))
  }
  for (const comp of COMPETITIONS) {
    const listFile = join(CACHE, `matches-${comp.id}.json`)
    const matches: Json[] = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : await getJson(`${RAW}/matches/${comp.id}/${SEASON_ID}.json`)
    writeFileSync(listFile, JSON.stringify(matches))
    const todo = matches.filter((m) => !existsSync(join(CACHE, 'matches', `${m.match_id}.json`)))
    console.log(`${comp.name}: ${matches.length} matches, ${todo.length} to download`)
    let done = 0
    const worker = async () => {
      for (let m = todo.shift(); m; m = todo.shift()) {
        const [events, lineups] = await Promise.all([getJson(`${RAW}/events/${m.match_id}.json`), getJson(`${RAW}/lineups/${m.match_id}.json`)])
        writeFileSync(join(CACHE, 'matches', `${m.match_id}.json`), JSON.stringify(summariseMatch(m, comp.id, events, lineups)))
        if (++done % 50 === 0) console.log(`  ${done} done`)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  }
}

// ---------------------------------------------------------------------------
// Season dataset
// ---------------------------------------------------------------------------

const nationsByName = new Map<string, Nation>(NATIONS.map(({ code, name, flag }) => [name, { code, name, flag }]))
function nation(name: string | null): Nation {
  const key = name ?? 'Unknown'
  let found = nationsByName.get(key)
  if (!found) {
    // No flag drawing for this country: a plain grey flag rather than a wrong one.
    found = { code: key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12) || 'UNK', name: key, flag: { kind: 'h', colors: ['#c9ced6'] } }
    nationsByName.set(key, found)
  }
  return found
}

function build() {
  // Birth dates, heights and club colours from Wikidata, when `npm run data:wikidata` has been run.
  const wikiFile = join(CACHE, '..', 'wikidata', 'matches.json')
  const wiki: WikidataMatches = existsSync(wikiFile) ? JSON.parse(readFileSync(wikiFile, 'utf8')) : { clubs: {}, players: {} }
  const summaries: MatchSummary[] = readdirSync(join(CACHE, 'matches')).map((f) => JSON.parse(readFileSync(join(CACHE, 'matches', f), 'utf8')))
  summaries.sort((a, b) => a.date.localeCompare(b.date))
  const report: string[] = []

  const leagues: League[] = []
  const clubs = new Map<string, Club>()
  const stadiums = new Map<string, Map<string, number>>()
  for (const comp of COMPETITIONS) {
    const own = summaries.filter((m) => m.competitionId === comp.id)
    if (!own.length) continue
    const leagueId = String(comp.id)
    const teams = new Set(own.flatMap((m) => [m.home.id, m.away.id]))
    leagues.push({ id: leagueId, name: comp.name, country: comp.country, nationCode: nation(comp.country).code, matchesPerSeason: (teams.size - 1) * 2 })
    const total = JSON.parse(readFileSync(join(CACHE, `matches-${comp.id}.json`), 'utf8')).length
    report.push(`${comp.name} ${SEASON}: ${own.length} of ${total} matches`)
    for (const m of own) {
      for (const t of [m.home, m.away]) {
        const id = String(t.id)
        if (!clubs.has(id)) clubs.set(id, { id, name: t.name, shortName: t.name, abbr: t.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), leagueId, colors: ['#5b6573', '#c9ced6'] })
      }
      if (m.home.stadium) {
        const tally = stadiums.get(String(m.home.id)) ?? new Map<string, number>()
        tally.set(m.home.stadium, (tally.get(m.home.stadium) ?? 0) + 1)
        stadiums.set(String(m.home.id), tally)
      }
    }
  }
  for (const [id, tally] of stadiums) clubs.get(id)!.stadium = [...tally].sort((a, b) => b[1] - a[1])[0][0]

  // Add matches up per player and club.
  const rows = new Map<string, PlayerSeason>()
  const people = new Map<number, { last: MatchPlayer; positions: Partial<Record<Position, number>> }>()
  for (const m of summaries) {
    for (const p of m.players) {
      const key = `${p.id}|${p.teamId}`
      const row = rows.get(key) ?? { playerId: String(p.id), season: SEASON, clubId: String(p.teamId), leagueId: String(m.competitionId), stats: { ...EMPTY_LINE } }
      for (const k of STAT_KEYS) row.stats[k] += p.stats[k]
      rows.set(key, row)
      const person = people.get(p.id) ?? { last: p, positions: {} }
      person.last = p
      for (const [pos, mins] of Object.entries(p.positionMins) as [Position, number][]) person.positions[pos] = (person.positions[pos] ?? 0) + mins
      people.set(p.id, person)
    }
  }
  for (const row of rows.values()) {
    for (const k of ['xg', 'npxg', 'xag'] as const) row.stats[k] = Math.round(row.stats[k] * 100) / 100
  }

  const players: Player[] = [...people.values()].map(({ last, positions }) => {
    const ranked = (Object.entries(positions) as [Position, number][]).sort((a, b) => b[1] - a[1])
    const primary = ranked[0]?.[0] ?? 'M (C)'
    // StatsBomb writes apostrophes doubled ("N''Golo Kanté").
    const clean = (name: string) => name.replace(/''/g, "'")
    const display = clean(last.name)
    const words = clean(last.fullName).split(' ')
    return {
      id: String(last.id),
      name: display,
      firstName: words.length > 1 ? words.slice(0, -1).join(' ') : '',
      lastName: display.split(' ').slice(-1)[0],
      fullName: clean(last.fullName),
      nationCode: nation(last.country).code,
      heightCm: wiki.players[String(last.id)]?.heightCm ?? 0,
      birthDate: wiki.players[String(last.id)]?.birthDate,
      primaryPosition: primary,
      // Other positions with at least 270 minutes (three full matches).
      secondaryPositions: ranked.slice(1).filter(([, mins]) => mins >= 270).map(([pos]) => pos),
      group: GROUP_OF[primary],
      clubId: String(last.teamId), // club of the player's last match that season
      shirtNumber: last.jersey,
    }
  })

  for (const club of clubs.values()) {
    // Wikidata lists colours in no set order; lead with a real colour rather than white (Leicester: blue, not white).
    const colors = [...(wiki.clubs[club.id]?.colors ?? [])].sort((a, b) => Number(a === '#ffffff') - Number(b === '#ffffff'))
    if (colors.length) club.colors = [colors[0], colors[1] ?? (colors[0] === '#ffffff' ? '#1f2933' : '#ffffff')]
  }
  // Age during the season, taken on 1 January 2016.
  for (const row of rows.values()) {
    const dob = wiki.players[row.playerId]?.birthDate
    if (dob) row.age = 2015 - Number(dob.slice(0, 4)) + (dob.slice(5) <= '01-01' ? 1 : 0)
  }

  const usedNations = new Set([...players.map((p) => p.nationCode), ...leagues.map((l) => l.nationCode)])
  const dataset: Dataset = {
    isSample: false,
    sourceName: 'StatsBomb Open Data',
    availableStats: AVAILABLE,
    seasons: [SEASON],
    currentSeason: SEASON,
    nations: [...nationsByName.values()].filter((n) => usedNations.has(n.code)),
    leagues,
    clubs: [...clubs.values()],
    players,
    playerSeasons: [...rows.values()],
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset))
  if (existsSync(join(CACHE, 'logo.png'))) writeFileSync(join(dirname(OUT), 'source-logo.png'), readFileSync(join(CACHE, 'logo.png')))
  console.log(report.join('\n'))
  console.log(`Wrote ${players.length} players, ${dataset.playerSeasons.length} player-seasons to ${OUT}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const skipDownload = process.argv.includes('--build-only')
  ;(skipDownload ? Promise.resolve() : download()).then(build).catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
