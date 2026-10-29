// Combines every downloaded source into the site's data.
//
//   npm run data:build
//
// Reads data-cache/statsbomb/dataset.json (2015/16), data-cache/pitchapi/dataset.json
// (2021/22 onwards) and data-cache/wikidata/matches.json, whichever exist, and:
//   - recognises the same league, club and player across sources (players and
//     clubs by their Wikidata id, leagues by name), so a career spans both;
//   - adds birth dates, season ages, heights and club colours from Wikidata;
//   - marks stats a source does not measure as unknown (null), never as zero;
//   - writes src/data/real/dataset.json (season rows packed as arrays) and
//     data-cache/build/images.json, the list `npm run data:images` downloads.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATIONS } from '../src/data/sample/nations.ts'
import { STAT_KEYS } from '../src/data/statline.ts'
import type { Club, Dataset, League, Nation, PackedDataset, Player, StatKey } from '../src/data/types.ts'
import type { WikidataMatches } from './wikidata.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache')
const OUT = join(ROOT, 'src', 'data', 'real', 'dataset.json')
const IMAGE_LIST = join(CACHE, 'build', 'images.json')

interface Source {
  name: string
  dataset: Dataset & { images?: { clubs: Record<string, string>; players: Record<string, string> } }
}

const SOURCES: Source[] = [
  ['StatsBomb Open Data', join(CACHE, 'statsbomb', 'dataset.json')],
  ['PitchAPI', join(CACHE, 'pitchapi', 'dataset.json')],
]
  .filter(([, file]) => existsSync(file))
  .map(([name, file]) => ({ name, dataset: JSON.parse(readFileSync(file, 'utf8')) }))
if (!SOURCES.length) {
  console.error('No source data yet. Run `npm run data:statsbomb` and/or `npm run data:pitchapi` first.')
  process.exit(1)
}
const wikiFile = join(CACHE, 'wikidata', 'matches.json')
const wiki: WikidataMatches = existsSync(wikiFile) ? JSON.parse(readFileSync(wikiFile, 'utf8')) : { clubs: {}, players: {} }

// Country names for the three-letter codes PitchAPI uses (flags come from the sample list where drawn).
const COUNTRY_NAMES: Record<string, string> = {
  ALB: 'Albania', ALG: 'Algeria', ANG: 'Angola', ARG: 'Argentina', ARM: 'Armenia', AUS: 'Australia', AUT: 'Austria', BEL: 'Belgium',
  BFA: 'Burkina Faso', BIH: 'Bosnia and Herzegovina', BRA: 'Brazil', BUL: 'Bulgaria', CAN: 'Canada', CHI: 'Chile', CIV: "Côte d'Ivoire",
  CMR: 'Cameroon', COD: 'DR Congo', COL: 'Colombia', CPV: 'Cape Verde', CRO: 'Croatia', CZE: 'Czechia', DEN: 'Denmark', ECU: 'Ecuador',
  EGY: 'Egypt', ENG: 'England', ESP: 'Spain', FIN: 'Finland', FRA: 'France', GAB: 'Gabon', GEO: 'Georgia', GER: 'Germany', GHA: 'Ghana',
  GRE: 'Greece', GUI: 'Guinea', HUN: 'Hungary', IRL: 'Republic of Ireland', ISL: 'Iceland', ISR: 'Israel', ITA: 'Italy', JAM: 'Jamaica',
  JPN: 'Japan', KOR: 'South Korea', KVX: 'Kosovo', MAR: 'Morocco', MEX: 'Mexico', MKD: 'North Macedonia', MLI: 'Mali', MNE: 'Montenegro',
  NED: 'Netherlands', NGA: 'Nigeria', NIR: 'Northern Ireland', NOR: 'Norway', NZL: 'New Zealand', PAR: 'Paraguay', PER: 'Peru',
  POL: 'Poland', POR: 'Portugal', ROU: 'Romania', RSA: 'South Africa', RUS: 'Russia', SCO: 'Scotland', SEN: 'Senegal', SRB: 'Serbia',
  SUI: 'Switzerland', SVK: 'Slovakia', SVN: 'Slovenia', SWE: 'Sweden', TUN: 'Tunisia', TUR: 'Türkiye', UKR: 'Ukraine', URU: 'Uruguay',
  USA: 'United States', UZB: 'Uzbekistan', VEN: 'Venezuela', WAL: 'Wales', ZAM: 'Zambia', ZIM: 'Zimbabwe',
}
const DRAWN = new Map(NATIONS.map(({ code, name, flag }) => [code, { code, name, flag } as Nation]))
const nations = new Map<string, Nation>()
function nation(code: string, name?: string): string {
  if (!nations.has(code)) nations.set(code, DRAWN.get(code) ?? { code, name: name ?? COUNTRY_NAMES[code] ?? code, flag: { kind: 'h', colors: ['#c9ced6'] } })
  return code
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Leagues are shared by name ("Premier League" in both sources is one league).
const leagues = new Map<string, League>()
const leagueOf = new Map<string, string>() // `${source}|${id}` → merged id

// Clubs and players are shared by Wikidata id; without one they stay per source.
const clubKey = (src: string, id: string) => wiki.clubs[id]?.qid ?? `${src}|${id}`
const playerKey = (src: string, id: string) => wiki.players[id]?.qid ?? `${src}|${id}`
const clubs = new Map<string, Club & { lastSeason: string }>()
const players = new Map<string, Player & { lastSeason: string }>()
const clubId = new Map<string, string>() // key → merged id
const playerId = new Map<string, string>()

type Row = { playerId: string; season: string; clubId: string; leagueId: string; age?: number; stats: (number | null)[] }
const rows: Row[] = []
const seasonSources: Record<string, string> = {}
const imageSources = { clubs: {} as Record<string, string[]>, players: {} as Record<string, string[]> }
const addImage = (kind: 'clubs' | 'players', id: string, url?: string) => {
  if (!url) return
  const list = (imageSources[kind][id] ??= [])
  if (!list.includes(url)) list.push(url)
}
const commons = (file?: string) => (file ? `commons:${file}` : undefined)

/** Age on 1 January of the season ("2015-16" → 1 Jan 2016). */
function seasonAge(birthDate: string, season: string) {
  const year = Number(season.slice(0, 4)) + 1
  return year - 1 - Number(birthDate.slice(0, 4)) + (birthDate.slice(5) <= '01-01' ? 1 : 0)
}

for (const { name: src, dataset } of SOURCES) {
  const measured = new Set<StatKey>(dataset.availableStats ?? STAT_KEYS)
  for (const s of dataset.seasons) seasonSources[s] = src
  for (const n of dataset.nations) if (!nations.has(n.code)) nations.set(n.code, n)

  for (const l of dataset.leagues) {
    const id = slug(l.name)
    if (!leagues.has(id)) leagues.set(id, { ...l, id })
    leagueOf.set(`${src}|${l.id}`, id)
  }
  const latestSeasonOfClub = new Map<string, string>()
  const latestSeasonOfPlayer = new Map<string, string>()
  for (const r of dataset.playerSeasons) {
    if ((latestSeasonOfClub.get(r.clubId) ?? '') < r.season) latestSeasonOfClub.set(r.clubId, r.season)
    if ((latestSeasonOfPlayer.get(r.playerId) ?? '') < r.season) latestSeasonOfPlayer.set(r.playerId, r.season)
  }

  for (const c of dataset.clubs) {
    const key = clubKey(src, c.id)
    const season = latestSeasonOfClub.get(c.id) ?? ''
    const prev = clubs.get(key)
    // The most recent source names the club and decides its current league; ids stay from the first source.
    const merged = { ...prev, ...c, id: prev?.id ?? c.id, leagueId: leagueOf.get(`${src}|${c.leagueId}`)!, lastSeason: season }
    if (!prev || prev.lastSeason <= season) clubs.set(key, merged)
    clubId.set(key, clubs.get(key)!.id)
    addImage('clubs', clubs.get(key)!.id, dataset.images?.clubs[c.id])
    addImage('clubs', clubs.get(key)!.id, commons(wiki.clubs[c.id]?.logo))
  }

  for (const p of dataset.players) {
    const key = playerKey(src, p.id)
    const season = latestSeasonOfPlayer.get(p.id) ?? ''
    const prev = players.get(key)
    const w = wiki.players[p.id]
    const merged: Player & { lastSeason: string } = {
      ...prev,
      ...p,
      id: prev?.id ?? p.id,
      clubId: clubId.get(clubKey(src, p.clubId))!,
      nationCode: nation(p.nationCode === 'UNK' && prev ? prev.nationCode : p.nationCode),
      birthDate: w?.birthDate ?? prev?.birthDate ?? p.birthDate,
      heightCm: w?.heightCm ?? (p.heightCm || prev?.heightCm || 0),
      lastSeason: season,
    }
    if (!prev || prev.lastSeason <= season) players.set(key, merged)
    else players.set(key, { ...prev, birthDate: prev.birthDate ?? merged.birthDate, heightCm: prev.heightCm || merged.heightCm })
    playerId.set(key, players.get(key)!.id)
    addImage('players', players.get(key)!.id, dataset.images?.players[p.id])
    addImage('players', players.get(key)!.id, commons(w?.photo))
  }

  for (const r of dataset.playerSeasons) {
    rows.push({
      playerId: playerId.get(playerKey(src, r.playerId))!,
      season: r.season,
      clubId: clubId.get(clubKey(src, r.clubId))!,
      leagueId: leagueOf.get(`${src}|${r.leagueId}`)!,
      stats: STAT_KEYS.map((k) => (measured.has(k) ? r.stats[k] : null)),
    })
  }
}

// Club colours from Wikidata; lead with a real colour rather than white (Leicester: blue, not white).
for (const [key, club] of clubs) {
  const qidColors = Object.values(wiki.clubs).find((c) => c.qid === key)?.colors ?? []
  const colors = [...qidColors].sort((a, b) => Number(a === '#ffffff') - Number(b === '#ffffff'))
  if (colors.length) club.colors = [colors[0], colors[1] ?? (colors[0] === '#ffffff' ? '#1f2933' : '#ffffff')]
}
const playerById = new Map([...players.values()].map((p) => [p.id, p]))
for (const r of rows) {
  const dob = playerById.get(r.playerId)?.birthDate
  if (dob) r.age = seasonAge(dob, r.season)
}

// The season shown first: the latest one that is (nearly) complete, not one a few rounds in.
const seasons = Object.keys(seasonSources).sort()
const minsBySeason = new Map(seasons.map((s) => [s, rows.filter((r) => r.season === s).reduce((a, r) => a + (r.stats[STAT_KEYS.indexOf('mins')] ?? 0), 0)]))
const fullest = Math.max(...minsBySeason.values())
const currentSeason = [...seasons].reverse().find((s) => minsBySeason.get(s)! >= 0.8 * fullest) ?? seasons[seasons.length - 1]

const strip = <T extends { lastSeason: string }>(item: T) => {
  const { lastSeason, ...rest } = item
  void lastSeason // only used while merging
  return rest
}
const packed: PackedDataset = {
  isSample: false,
  sourceName: SOURCES.map((s) => s.name).join(' & '),
  seasonSources,
  availableStats: STAT_KEYS,
  seasons,
  currentSeason,
  nations: [...nations.values()],
  leagues: [...leagues.values()],
  clubs: [...clubs.values()].map(strip),
  players: [...players.values()].map(strip),
  playerSeasons: [],
  statKeys: STAT_KEYS,
  packedRows: rows.map((r) => [r.playerId, r.season, r.clubId, r.leagueId, r.age ?? null, ...r.stats]),
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(packed))
mkdirSync(dirname(IMAGE_LIST), { recursive: true })
writeFileSync(IMAGE_LIST, JSON.stringify(imageSources))
// StatsBomb's logo must accompany anything published from their data.
const sbLogo = join(CACHE, 'statsbomb', 'logo.png')
if (existsSync(sbLogo) && SOURCES.some((s) => s.name.startsWith('StatsBomb'))) writeFileSync(join(dirname(OUT), 'source-logo.png'), readFileSync(sbLogo))

const linked = [...players.keys()].filter((k) => !k.includes('|')).length
console.log(
  `${seasons.length} seasons (${seasons.join(', ')}), showing ${currentSeason} first\n` +
    `${players.size} players (${linked} with a Wikidata id), ${clubs.size} clubs, ${rows.length} player-seasons\n` +
    `Wrote ${OUT}`,
)
