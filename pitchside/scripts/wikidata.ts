// Matches every source's clubs and players to Wikidata, for details the match
// data lacks: birth dates, heights, club colours, the Wikimedia Commons file
// names of freely licensed crests and photos, and Wikidata ids, which
// `npm run data:build` uses to recognise the same player or club across sources.
//
//   npm run data:wikidata      (after data:statsbomb and/or data:pitchapi)
//
// Writes data-cache/wikidata/matches.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Dataset } from '../src/data/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache', 'wikidata')
const OUT = join(CACHE, 'matches.json')
/** Each source's season dataset, and the period its squads are looked up for. */
const SOURCES = [
  { file: join(ROOT, 'data-cache', 'statsbomb', 'dataset.json'), from: '2015-07-01', to: '2016-06-30' },
  { file: join(ROOT, 'data-cache', 'pitchapi', 'dataset.json'), from: '2021-07-01', to: '2027-06-30' },
]
export const USER_AGENT = 'Pitchside/0.1 (personal football statistics prototype)'


export interface WikidataMatches {
  clubs: Record<string, { qid: string; label: string; logo?: string; colors?: string[] }>
  players: Record<string, { qid: string; label: string; photo?: string; birthDate?: string; heightCm?: number }>
}

// oxlint-disable-next-line no-explicit-any
type Json = any

async function sparql(query: string): Promise<Json[]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
    })
    if (res.ok) return (await res.json()).results.bindings
    if (attempt >= 4) throw new Error(`Wikidata query failed: HTTP ${res.status}`)
    await new Promise((r) => setTimeout(r, 5000 * attempt))
  }
}

const qid = (uri: string) => uri.split('/').pop()!
/** Commons file name from a Special:FilePath URL. */
const fileName = (uri?: string) => (uri ? decodeURIComponent(uri.split('/Special:FilePath/')[1]).replace(/ /g, '_') : undefined)

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Words that differ between how StatsBomb and Wikipedia name the same club.
const CLUB_NOISE = new Set(['fc', 'cf', 'afc', 'ac', 'as', 'ss', 'us', 'sc', 'rc', 'ca', 'cd', 'ud', 'rcd', 'sd', 'ogc', 'losc', 'calcio', 'club', 'de', 'del', 'football', 'futbol', 'f', 'c', 'a', 's', 'sad', '1907', '1909', '1913', '1919', 'spa', 'sl', 'real', 'rcde'])
// Clubs StatsBomb names too differently to match by words.
const CLUB_ALIASES: Record<string, string> = { Rennes: 'Stade Rennais' }
const clubTokens = (name: string) => new Set(normalize(name).split(' ').filter((w) => !CLUB_NOISE.has(w)))

function overlap(a: Set<string>, b: Set<string>) {
  let shared = 0
  for (const w of a) if (b.has(w) || [...b].some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))) shared++
  // Share of the shorter name matched, plus share of the longer one as a tie-break,
  // so "Inter Milan" prefers "Inter Milan" over "AC Milan".
  return shared / Math.max(1, Math.min(a.size, b.size)) + (0.5 * shared) / Math.max(1, a.size, b.size)
}

// Wikidata items of the leagues, for finding a season by league and start year.
const LEAGUE_ITEMS: Record<string, string> = { 'Premier League': 'Q9448', 'La Liga': 'Q324867', 'Serie A': 'Q15804', Bundesliga: 'Q82595', 'Ligue 1': 'Q13394' }

/** The Wikidata item for a league's season, e.g. "2015–16 Premier League" (the one listing its clubs). */
async function seasonItem(league: string, season: string, cache: Record<string, string>): Promise<string | undefined> {
  const label = `${season.slice(0, 4)}–${season.slice(5, 7)} ${league}` // "2015-16" → "2015–16"
  if (cache[label]) return cache[label]
  let rows = await sparql(`
    SELECT ?s (COUNT(?t) AS ?n) WHERE { ?s rdfs:label "${label}"@en . ?s wdt:P1923 ?t } GROUP BY ?s ORDER BY DESC(?n) LIMIT 1`)
  // Not every season item carries the usual name: look for "season of <league>" starting that year instead.
  if (!rows[0] && LEAGUE_ITEMS[league]) {
    rows = await sparql(`
      SELECT ?s (COUNT(?t) AS ?n) WHERE {
        ?s wdt:P3450 wd:${LEAGUE_ITEMS[league]} ; wdt:P580 ?start ; wdt:P1923 ?t . FILTER(YEAR(?start) = ${season.slice(0, 4)})
      } GROUP BY ?s ORDER BY DESC(?n) LIMIT 1`)
  }
  if (rows[0]) cache[label] = qid(rows[0].s.value)
  return cache[label]
}

async function main() {
  const matches: WikidataMatches = { clubs: {}, players: {} }
  const report: string[] = []
  const seasonCacheFile = join(CACHE, 'seasons.json')
  const seasonCache: Record<string, string> = existsSync(seasonCacheFile) ? JSON.parse(readFileSync(seasonCacheFile, 'utf8')) : {}
  mkdirSync(CACHE, { recursive: true })

  for (const source of SOURCES) {
    if (!existsSync(source.file)) continue
    const dataset: Dataset = JSON.parse(readFileSync(source.file, 'utf8'))
    const playerById = new Map(dataset.players.map((p) => [p.id, p]))
    const clubQid = new Map<string, string>()
    const squads = new Map<string, Json[]>()
    // A club's identity item plus the item the season listed, when they differ (players may point to either).
    const teamItems = new Map<string, Set<string>>()

    for (const league of dataset.leagues) {
      for (const season of dataset.seasons) {
        const rows = dataset.playerSeasons.filter((r) => r.leagueId === league.id && r.season === season)
        if (!rows.length) continue
        const item = await seasonItem(league.name, season, seasonCache)
        if (!item) report.push(`  ${league.name} ${season}: no Wikidata season item (clubs known from other seasons still match)`)

        // Clubs: crest (P154) and official colours (P6364 → hex P465). Some seasons list a club's
        // "men's team" item, which is part of (P361) the club that players' histories point to.
        const teams = !item
          ? []
          : await sparql(`
          SELECT ?team ?teamLabel (SAMPLE(?listed) AS ?listedItem) (SAMPLE(?logo) AS ?logo) (GROUP_CONCAT(DISTINCT ?hex; separator="|") AS ?hexes) WHERE {
            wd:${item} wdt:P1923 ?listed .
            OPTIONAL { ?listed wdt:P31 wd:Q103229495 ; wdt:P361 ?parent }
            BIND(COALESCE(?parent, ?listed) AS ?team)
            OPTIONAL { ?team wdt:P154 ?logo }
            OPTIONAL { ?team wdt:P6364 ?color . ?color wdt:P465 ?hex }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
          } GROUP BY ?team ?teamLabel`)
        const clubIds = [...new Set(rows.map((r) => r.clubId))].filter((id) => !clubQid.has(id))
        const clubs = dataset.clubs.filter((c) => clubIds.includes(c.id))
        // Best pairs first across the whole league, so one club cannot take another's match
        // (e.g. Real Madrid and Atlético Madrid both containing "Madrid").
        const pairs = clubs
          .flatMap((club) => teams.map((t) => ({ club, t, score: overlap(clubTokens(CLUB_ALIASES[club.name] ?? club.name), clubTokens(t.teamLabel.value)) })))
          .filter((x) => x.score >= 0.5)
          .sort((a, b) => b.score - a.score)
        const taken = new Set([...clubQid.values()])
        for (const { club, t } of pairs) {
          if (clubQid.has(club.id) || taken.has(qid(t.team.value))) continue
          taken.add(qid(t.team.value))
          clubQid.set(club.id, qid(t.team.value))
          teamItems.set(qid(t.team.value), new Set([qid(t.team.value), qid(t.listedItem?.value ?? t.team.value), ...(teamItems.get(qid(t.team.value)) ?? [])]))
          matches.clubs[club.id] = {
            qid: qid(t.team.value),
            label: t.teamLabel.value,
            logo: fileName(t.logo?.value),
            colors: t.hexes?.value ? t.hexes.value.split('|').map((h: string) => `#${h.toLowerCase()}`) : undefined,
          }
        }
        if (item) for (const club of clubs) if (!clubQid.has(club.id)) report.push(`  no Wikidata club for ${club.name} (${league.name} ${season})`)

        // Players: everyone Wikidata lists at each club during this source's period, with any names they go by.
        // One query per club keeps each well inside the query service's time limit.
        for (const team of new Set(rows.map((r) => clubQid.get(r.clubId)).filter((q): q is string => !!q))) {
          if (squads.has(team)) continue
          squads.set(
            team,
            await sparql(`
              SELECT ?p ?pLabel (SAMPLE(?img) AS ?img) (SAMPLE(?dob) AS ?dob) (SAMPLE(?h) AS ?h)
                     (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
                VALUES ?club { ${[...(teamItems.get(team) ?? [team])].map((q) => `wd:${q}`).join(' ')} }
                ?p p:P54 ?st . ?st ps:P54 ?club .
                OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
                FILTER(!BOUND(?start) || ?start <= "${source.to}T00:00:00Z"^^xsd:dateTime)
                FILTER(!BOUND(?end) || ?end >= "${source.from}T00:00:00Z"^^xsd:dateTime)
                OPTIONAL { ?p wdt:P18 ?img }
                OPTIONAL { ?p wdt:P569 ?dob }
                OPTIONAL { ?p p:P2048/psn:P2048/wikibase:quantityAmount ?h }
                OPTIONAL { { ?p skos:altLabel ?alt FILTER(LANG(?alt) = "en") } UNION { ?p wdt:P1477 ?alt } }
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
              } GROUP BY ?p ?pLabel`),
          )
        }

        let found = 0
        for (const row of rows) {
          const player = playerById.get(row.playerId)!
          if (matches.players[player.id]) {
            found++
            continue
          }
          const candidates = squads.get(clubQid.get(row.clubId) ?? '') ?? []
          const mine = [player.name, player.fullName ?? `${player.firstName} ${player.lastName}`].map(normalize)
          const myTokens = new Set(mine.join(' ').split(' '))
          const scored = candidates
            .map((c) => {
              const names = [c.pLabel.value, ...(c.alts?.value ? c.alts.value.split('|') : [])].map(normalize)
              let score = 0
              if (names.some((n) => mine.includes(n))) score = 3
              // Every word of one of their (multi-word) names appears in ours, e.g. "Gareth Bale" in "Gareth Frank Bale".
              // One-word names ("Álvaro") must match exactly, or they would fit half the squad.
              else if (names.some((n) => n.includes(' ') && n.split(' ').every((w) => myTokens.has(w)))) score = 2
              // Same surname and a similar first name ("Brad Smith" / "Bradley Smith").
              else if (names.some((n) => n.includes(' ') && n.split(' ').slice(-1)[0] === normalize(player.lastName) && n.slice(0, 3) === mine[0].slice(0, 3))) score = 1
              return { c, score }
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
          // Skip ties: better no picture than the wrong person's.
          if (!scored.length || (scored[1] && scored[1].score === scored[0].score && scored[1].c.p.value !== scored[0].c.p.value)) continue
          const c = scored[0].c
          const height = c.h ? Number(c.h.value) : NaN
          matches.players[player.id] = {
            qid: qid(c.p.value),
            label: c.pLabel.value,
            photo: fileName(c.img?.value),
            birthDate: c.dob?.value.slice(0, 10),
            heightCm: height > 1.4 && height < 2.2 ? Math.round(height * 100) : undefined,
          }
          found++
        }
        console.log(`${league.name} ${season}: ${found}/${rows.length} players matched`)
      }
    }
    writeFileSync(seasonCacheFile, JSON.stringify(seasonCache, null, 1))
  }

  writeFileSync(OUT, JSON.stringify(matches, null, 1))
  console.log(report.join('\n'))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
