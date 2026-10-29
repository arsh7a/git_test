// Matches StatsBomb clubs and players to Wikidata, for details the match data
// lacks: birth dates, heights, club colours, and the Wikimedia Commons file
// names of club crests and player photos (freely licensed images only).
//
//   npm run data:wikidata      (after npm run data:statsbomb)
//
// Writes data-cache/wikidata/matches.json, which `npm run data:statsbomb`
// then folds into the dataset, and `npm run data:images` uses to fetch images.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Dataset } from '../src/data/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'data-cache', 'wikidata', 'matches.json')
const DATASET = join(ROOT, 'src', 'data', 'real', 'dataset.json')
export const USER_AGENT = 'Pitchside/0.1 (personal football statistics prototype)'

/** Wikidata items for each StatsBomb competition's 2015/16 season. */
const SEASON_ITEMS: Record<string, string> = { '2': 'Q19346732', '11': 'Q16621994', '12': 'Q19309054', '7': 'Q19820211' }

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
  return shared / Math.max(1, Math.min(a.size, b.size))
}

async function main() {
  const dataset: Dataset = JSON.parse(readFileSync(DATASET, 'utf8'))
  const matches: WikidataMatches = { clubs: {}, players: {} }
  const report: string[] = []

  for (const league of dataset.leagues) {
    const season = SEASON_ITEMS[league.id]
    if (!season) continue

    // Clubs: crest (P154) and official colours (P6364 → hex P465).
    const teams = await sparql(`
      SELECT ?team ?teamLabel (SAMPLE(?logo) AS ?logo) (GROUP_CONCAT(DISTINCT ?hex; separator="|") AS ?hexes) WHERE {
        wd:${season} wdt:P1923 ?team .
        OPTIONAL { ?team wdt:P154 ?logo }
        OPTIONAL { ?team wdt:P6364 ?color . ?color wdt:P465 ?hex }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } GROUP BY ?team ?teamLabel`)
    const clubs = dataset.clubs.filter((c) => c.leagueId === league.id)
    const taken = new Set<string>()
    const clubQid = new Map<string, string>()
    for (const club of clubs) {
      const scored = teams
        .map((t) => ({ t, score: overlap(clubTokens(CLUB_ALIASES[club.name] ?? club.name), clubTokens(t.teamLabel.value)) }))
        .filter((x) => !taken.has(x.t.team.value))
        .sort((a, b) => b.score - a.score)
      const best = scored[0]
      if (!best || best.score < 0.5) {
        report.push(`  no Wikidata club for ${club.name}`)
        continue
      }
      taken.add(best.t.team.value)
      clubQid.set(club.id, qid(best.t.team.value))
      matches.clubs[club.id] = {
        qid: qid(best.t.team.value),
        label: best.t.teamLabel.value,
        logo: fileName(best.t.logo?.value),
        colors: best.t.hexes?.value ? best.t.hexes.value.split('|').map((h: string) => `#${h.toLowerCase()}`) : undefined,
      }
    }

    // Players: everyone Wikidata lists at each club around 2015/16, with any names they go by.
    // One query per club keeps each well inside the query service's time limit.
    const byTeam = new Map<string, Json[]>()
    console.log(`${league.name}: looking up ${clubQid.size} squads`)
    for (const team of new Set(clubQid.values())) {
      byTeam.set(
        team,
        await sparql(`
          SELECT ?p ?pLabel (SAMPLE(?img) AS ?img) (SAMPLE(?dob) AS ?dob) (SAMPLE(?h) AS ?h)
                 (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
            ?p p:P54 ?st . ?st ps:P54 wd:${team} .
            OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
            FILTER(!BOUND(?start) || ?start <= "2016-06-30T00:00:00Z"^^xsd:dateTime)
            FILTER(!BOUND(?end) || ?end >= "2015-07-01T00:00:00Z"^^xsd:dateTime)
            OPTIONAL { ?p wdt:P18 ?img }
            OPTIONAL { ?p wdt:P569 ?dob }
            OPTIONAL { ?p p:P2048/psn:P2048/wikibase:quantityAmount ?h }
            OPTIONAL { { ?p skos:altLabel ?alt FILTER(LANG(?alt) = "en") } UNION { ?p wdt:P1477 ?alt } }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
          } GROUP BY ?p ?pLabel`),
      )
    }

    const inLeague = dataset.playerSeasons.filter((r) => r.leagueId === league.id)
    let found = 0
    for (const row of inLeague) {
      const player = dataset.players.find((p) => p.id === row.playerId)!
      if (matches.players[player.id]) {
        found++
        continue
      }
      const candidates = byTeam.get(clubQid.get(row.clubId) ?? '') ?? []
      const mine = [player.name, `${player.firstName} ${player.lastName}`].map(normalize)
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
    const withPhoto = inLeague.filter((r) => matches.players[r.playerId]?.photo).length
    report.unshift(`${league.name}: ${clubQid.size}/${clubs.length} clubs, ${found}/${inLeague.length} players matched, ${withPhoto} with a photo, ${clubs.filter((c) => matches.clubs[c.id]?.logo).length} free crests`)
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(matches, null, 1))
  console.log(report.join('\n'))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
