// Turns the cached API-Football responses (from `npm run fetch:api`) into the
// site's Dataset shape, written to src/data/real/dataset.json.
//
//   npm run build:data
//
// Uses only what is already cached; it makes no network requests. Delete
// src/data/real/dataset.json to switch the site back to sample data.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATIONS } from '../src/data/sample/nations.ts'
import { EMPTY_LINE } from '../src/data/statline.ts'
import type { Club, Dataset, League, Nation, Player, PlayerSeason, Position, PositionGroup, StatKey, StatLine } from '../src/data/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache', 'api-football')
const OUT = join(ROOT, 'src', 'data', 'real', 'dataset.json')

/** What API-Football's player season statistics actually contain. */
const AVAILABLE: StatKey[] = [
  'apps', 'starts', 'mins', 'goals', 'assists', 'npg', 'pkGoals', 'pkAtt', 'shots', 'sot', 'passAtt', 'keyPasses',
  'tackles', 'blocks', 'interceptions', 'duels', 'duelsWon', 'dribblesAtt', 'dribblesSucc', 'fouls', 'fouled',
  'yellows', 'reds', 'ratingMins', 'goalsAgainst', 'saves', 'sotAgainst',
]
// Not included on purpose: passes.accuracy is not a reliable percentage in this
// feed, and xG, progressive actions, touches and clean sheets are not provided.

// API-Football only gives four broad positions.
const POSITIONS: Record<string, { position: Position; group: PositionGroup }> = {
  Goalkeeper: { position: 'GK', group: 'GK' },
  Defender: { position: 'D (C)', group: 'CB' },
  Midfielder: { position: 'M (C)', group: 'CM' },
  Attacker: { position: 'ST (C)', group: 'ST' },
}

const NEUTRAL_COLORS: [string, string] = ['#5b6573', '#c9ced6']

// oxlint-disable-next-line no-explicit-any
type Json = any
const readJson = (file: string): Json => JSON.parse(readFileSync(file, 'utf8'))
const files = (dir: string) => (existsSync(join(CACHE, dir)) ? readdirSync(join(CACHE, dir)).map((f) => join(CACHE, dir, f)) : [])
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const seasonLabel = (year: number) => `${year}-${String((year + 1) % 100).padStart(2, '0')}`

const nationsByName = new Map<string, Nation>(NATIONS.map(({ code, name, flag }) => [name, { code, name, flag }]))
function nation(name: string | null): Nation {
  const key = name ?? 'Unknown'
  let found = nationsByName.get(key)
  if (!found) {
    // No flag drawing for this country yet: show a plain grey flag rather than a wrong one.
    found = { code: key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12) || 'UNK', name: key, flag: { kind: 'h', colors: ['#c9ced6'] } }
    nationsByName.set(key, found)
  }
  return found
}

function ageAt(birthDate: string, on: Date): number {
  const b = new Date(birthDate + 'T00:00:00Z')
  let age = on.getUTCFullYear() - b.getUTCFullYear()
  if (on.getUTCMonth() < b.getUTCMonth() || (on.getUTCMonth() === b.getUTCMonth() && on.getUTCDate() < b.getUTCDate())) age--
  return age
}

function statLine(s: Json): StatLine {
  const goals = n(s.goals.total)
  const pkGoals = n(s.penalty.scored)
  const mins = n(s.games.minutes)
  const rating = Number(s.games.rating)
  const isGK = s.games.position === 'Goalkeeper'
  const saves = isGK ? n(s.goals.saves) : 0
  const conceded = isGK ? n(s.goals.conceded) : 0
  return {
    ...EMPTY_LINE,
    apps: n(s.games.appearences),
    starts: n(s.games.lineups),
    mins,
    goals,
    assists: n(s.goals.assists),
    npg: Math.max(0, goals - pkGoals),
    pkGoals,
    pkAtt: pkGoals + n(s.penalty.missed),
    shots: n(s.shots.total),
    sot: n(s.shots.on),
    passAtt: n(s.passes.total),
    keyPasses: n(s.passes.key),
    tackles: n(s.tackles.total),
    blocks: n(s.tackles.blocks),
    interceptions: n(s.tackles.interceptions),
    duels: n(s.duels.total),
    duelsWon: n(s.duels.won),
    dribblesAtt: n(s.dribbles.attempts),
    dribblesSucc: n(s.dribbles.success),
    fouls: n(s.fouls.committed),
    fouled: n(s.fouls.drawn),
    yellows: n(s.cards.yellow),
    reds: n(s.cards.red) + n(s.cards.yellowred),
    ratingMins: Number.isFinite(rating) ? rating * mins : 0,
    goalsAgainst: conceded,
    saves,
    // Shots on target faced = saves + goals conceded (own goals make this slightly high).
    sotAgainst: saves + conceded,
  }
}

const leagues = new Map<string, League>()
const clubs = new Map<string, Club>()
const players = new Map<string, Player>()
const latestSeasonOf = new Map<string, string>()
const playerSeasons: PlayerSeason[] = []
const seasons = new Set<string>()
const report: string[] = []

for (const file of files('standings')) {
  const body = readJson(file)
  const { league: lg } = body.response[0]
  const year = Number(body.parameters.season)
  const leagueId = String(lg.id)
  const table: Json[] = lg.standings.flat()
  const season = seasonLabel(year)
  const midSeason = new Date(Date.UTC(year + 1, 0, 1))

  const teamInfo = new Map<number, Json>()
  for (const f of files('teams')) {
    const t = readJson(f)
    if (t.parameters.league === String(lg.id) && t.parameters.season === String(year)) {
      for (const r of t.response) teamInfo.set(r.team.id, r)
    }
  }

  let teamsWithPlayers = 0
  for (const row of table) {
    const teamId = row.team.id as number
    const pages = files('players').filter((f) => f.includes(`season-${year}_team-${teamId}.json`))
    if (!pages.length) continue
    teamsWithPlayers++

    const info = teamInfo.get(teamId)
    const clubId = String(teamId)
    clubs.set(clubId, {
      id: clubId,
      name: row.team.name,
      shortName: row.team.name,
      abbr: info?.team.code ?? row.team.name.slice(0, 3).toUpperCase(),
      leagueId,
      colors: NEUTRAL_COLORS,
      stadium: info?.venue?.name ?? undefined,
      founded: info?.team.founded ?? undefined,
    })

    let goalsCounted = 0
    const keepers: { name: string; mins: number }[] = []
    const seen = new Set<number>()
    for (const page of pages) {
      for (const entry of readJson(page).response as Json[]) {
        const p = entry.player
        if (seen.has(p.id)) continue
        const stat = (entry.statistics as Json[]).find((s) => s.league.id === lg.id && s.team.id === teamId)
        if (!stat || !n(stat.games.minutes)) continue
        seen.add(p.id)
        const map = POSITIONS[stat.games.position] ?? POSITIONS.Midfielder
        const id = String(p.id)
        const stats = statLine(stat)
        goalsCounted += stats.goals
        if (map.group === 'GK') keepers.push({ name: p.name, mins: stats.mins })
        playerSeasons.push({ playerId: id, season, clubId, leagueId, age: p.birth.date ? ageAt(p.birth.date, midSeason) : n(p.age), stats })
        // Profile details (current club, position) come from the player's latest season.
        if ((latestSeasonOf.get(id) ?? '') <= season) {
          latestSeasonOf.set(id, season)
          players.set(id, {
            id,
            name: p.name,
            firstName: p.firstname ?? '',
            lastName: p.lastname ?? p.name,
            birthDate: p.birth.date ?? '',
            nationCode: nation(p.nationality).code,
            heightCm: parseInt(p.height ?? '', 10) || 0,
            primaryPosition: map.position,
            secondaryPositions: [],
            group: map.group,
            clubId,
          })
        }
      }
    }
    // Team goals include own goals by opponents, so the player total is usually a little lower.
    const teamGoals = row.all.goals.for
    if (goalsCounted < teamGoals - 6) report.push(`  ${season} ${row.team.name}: players account for ${goalsCounted} of ${teamGoals} goals; some players may be missing`)
    // API-Football sometimes files a transferred player's season under his *current* club
    // (e.g. a keeper on loan elsewhere). One goal can only have one keeper at a time.
    const keeperMins = keepers.reduce((a, k) => a + k.mins, 0)
    if (keeperMins > n(row.all.played) * 90 * 1.02) {
      report.push(`  ${season} ${row.team.name}: goalkeepers total ${keeperMins} minutes in ${row.all.played} matches; check ${keepers.map((k) => `${k.name} (${k.mins})`).join(', ')}`)
    }
  }

  if (teamsWithPlayers) {
    seasons.add(season)
    leagues.set(leagueId, { id: leagueId, name: lg.name, country: lg.country, nationCode: nation(lg.country).code, matchesPerSeason: (table.length - 1) * 2 })
  }
  report.unshift(`${lg.name} ${season}: ${teamsWithPlayers} of ${table.length} teams have player data`)
}

// The same player with an identical line at two clubs is the mislabelling described above.
const lineKey = (r: PlayerSeason) => `${r.playerId}|${r.season}|${r.leagueId}|${r.stats.mins}|${r.stats.goals}|${r.stats.apps}`
const byLine = new Map<string, PlayerSeason[]>()
for (const r of playerSeasons) byLine.set(lineKey(r), [...(byLine.get(lineKey(r)) ?? []), r])
for (const rows of byLine.values()) {
  if (rows.length > 1) report.push(`  ${rows[0].season} player ${players.get(rows[0].playerId)?.name}: identical line at clubs ${rows.map((r) => clubs.get(r.clubId)?.name).join(' and ')}; only one is right`)
}

if (!playerSeasons.length) {
  console.error('No cached player data found. Run `npm run fetch:api -- --league 39 --season 2024` first.')
  process.exit(1)
}

const seasonList = [...seasons].sort()
const usedNations = new Set([...players.values()].map((p) => p.nationCode))
for (const l of leagues.values()) usedNations.add(l.nationCode)

const dataset: Dataset = {
  isSample: false,
  sourceName: 'API-Football (api-sports.io)',
  availableStats: AVAILABLE,
  seasons: seasonList,
  currentSeason: seasonList[seasonList.length - 1],
  groupLabels: { CB: 'Defenders', CM: 'Midfielders', ST: 'Forwards' },
  nations: [...nationsByName.values()].filter((x) => usedNations.has(x.code)),
  leagues: [...leagues.values()],
  clubs: [...clubs.values()],
  players: [...players.values()],
  playerSeasons,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(dataset))
console.log(report.join('\n'))
console.log(`Wrote ${dataset.players.length} players, ${playerSeasons.length} player-seasons to ${OUT}`)
