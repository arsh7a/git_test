// Downloads one league-season from API-Football into a local cache.
//
//   npm run fetch:api -- --league 39 --season 2024
//
// Reads the key from the API_FOOTBALL_KEY environment variable. Every response
// is saved under data-cache/api-football/, so running the command again only
// downloads what is still missing. It is safe to stop and re-run at any time.
//
// Free plan limits (checked October 2026):
//   - 100 requests per day, 10 per minute
//   - seasons 2022, 2023 and 2024 only
//   - the `page` parameter can be at most 3 (20 players per page)
// Because of the page limit, players are fetched per team rather than per
// league. Results for a team are ordered by player id, so the 3-page cap only
// drops the newest (usually academy) registrations of very large squads.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://v3.football.api-sports.io'
const MAX_PAGE = 3
const MIN_GAP_MS = 6500 // stays under 10 requests per minute
const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data-cache', 'api-football')

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`)
  const v = i >= 0 ? process.argv[i + 1] : fallback
  if (v == null) throw new Error(`Missing --${name}`)
  return v
}

const league = arg('league')
const season = arg('season')
/** Stop once the day's remaining requests fall to this number. */
const reserve = Number(arg('reserve', '5'))

const key = process.env.API_FOOTBALL_KEY
if (!key) {
  console.error('API_FOOTBALL_KEY is not set.')
  process.exit(1)
}

export function cachePath(endpoint: string, params: Record<string, string | number>): string {
  const name = Object.keys(params).sort().map((k) => `${k}-${params[k]}`).join('_')
  return join(CACHE_DIR, endpoint.replace(/\//g, '_'), `${name}.json`)
}

class QuotaReached extends Error {}

let lastCall = 0
let remaining = Infinity
let calls = 0

// oxlint-disable-next-line no-explicit-any
async function get(endpoint: string, params: Record<string, string | number>): Promise<any> {
  const file = cachePath(endpoint, params)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  if (remaining <= reserve) throw new QuotaReached()

  const wait = lastCall + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const res = await fetch(`${API}/${endpoint}?${qs}`, { headers: { 'x-apisports-key': key! } })
  calls++
  const left = res.headers.get('x-ratelimit-requests-remaining')
  if (left != null) remaining = Number(left)
  if (!res.ok) throw new Error(`${endpoint} ${qs}: HTTP ${res.status}`)
  const body = await res.json()
  // API-Football reports problems (bad plan, bad parameter) in `errors`, with HTTP 200.
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors ?? {})
  if (errors.length) {
    if (JSON.stringify(body.errors).toLowerCase().includes('request limit')) throw new QuotaReached()
    throw new Error(`${endpoint} ${qs}: ${JSON.stringify(body.errors)}`)
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(body))
  console.log(`  fetched ${endpoint} ${qs}  (${remaining} left today)`)
  return body
}

async function main() {
  console.log(`League ${league}, season ${season}`)
  const standings = await get('standings', { league, season })
  const table = standings.response[0]?.league.standings.flat() ?? []
  if (!table.length) throw new Error('No standings returned; is this league/season on your plan?')
  await get('teams', { league, season }) // stadiums, founding years, short codes

  let done = 0
  const truncated: string[] = []
  for (const row of table) {
    const team = row.team.id
    const first = await get('players', { team, season })
    const total = first.paging.total as number
    for (let page = 2; page <= Math.min(total, MAX_PAGE); page++) await get('players', { team, season, page })
    if (total > MAX_PAGE) truncated.push(`${row.team.name} (${total} pages, only ${MAX_PAGE} available)`)
    done++
  }
  console.log(`Done: ${done}/${table.length} teams cached, ${calls} requests used this run.`)
  if (truncated.length) console.log(`Squads cut off by the free plan's page limit:\n  ${truncated.join('\n  ')}`)
}

main().catch((e) => {
  if (e instanceof QuotaReached) {
    console.log(`Stopped: daily request allowance reached (${calls} used this run). Run the same command tomorrow to continue.`)
    return
  }
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
