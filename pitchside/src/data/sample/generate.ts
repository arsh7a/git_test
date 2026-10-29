import { createRng, type Rng } from '../rng'
import type {
  Club,
  Dataset,
  League,
  Player,
  PlayerSeason,
  Position,
  PositionGroup,
  StatLine,
} from '../types'
import { NATIONS, type NationPool } from './nations'
import { CLUB_COLORS, LEAGUE_SEEDS } from './world'

// ---------------------------------------------------------------------------
// Generates a complete, fictional, *sample* dataset. Nothing here describes a
// real player or real match. The output follows the same `Dataset` shape a
// real data provider would be converted into later.
// ---------------------------------------------------------------------------

const SEASONS = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26']
const CURRENT_SEASON = '2025-26'
const CURRENT_START_YEAR = 2025
const MATCHES = 34
const FULL_SEASON_MINS = MATCHES * 90

const seasonStartYear = (season: string) => Number(season.slice(0, 4))

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round1 = (v: number) => Math.round(v * 10) / 10

// The 22-player squad every club starts with.
const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK', 'GK',
  'D (C)', 'D (C)', 'D (C)', 'D (C)',
  'D (R)', 'D (R)', 'D (L)', 'D (L)',
  'DM', 'DM',
  'M (C)', 'M (C)', 'M (C)',
  'AM (C)', 'AM (C)',
  'AM (R)', 'AM (L)',
  'ST (C)', 'ST (C)',
]

export const GROUP_OF: Record<Position, PositionGroup> = {
  GK: 'GK',
  'D (C)': 'CB',
  'D (L)': 'FB',
  'D (R)': 'FB',
  'WB (L)': 'FB',
  'WB (R)': 'FB',
  DM: 'DM',
  'M (C)': 'CM',
  'M (L)': 'W',
  'M (R)': 'W',
  'AM (C)': 'AM',
  'AM (L)': 'W',
  'AM (R)': 'W',
  'ST (C)': 'ST',
}

/** How many players from each group start a typical match (sums to ~11). */
const STARTER_SLOTS: Record<PositionGroup, number> = {
  GK: 1, CB: 2, FB: 2, DM: 1, CM: 1.5, AM: 0.8, W: 1.7, ST: 1,
}

const SECONDARY: Record<string, [Position, number][]> = {
  'D (C)': [['DM', 0.2], ['D (R)', 0.1]],
  'D (R)': [['WB (R)', 0.6], ['M (R)', 0.15], ['D (C)', 0.15]],
  'D (L)': [['WB (L)', 0.6], ['M (L)', 0.15], ['D (C)', 0.15]],
  DM: [['M (C)', 0.7], ['D (C)', 0.2]],
  'M (C)': [['DM', 0.4], ['AM (C)', 0.4]],
  'AM (C)': [['M (C)', 0.5], ['ST (C)', 0.3], ['AM (L)', 0.15]],
  'AM (R)': [['M (R)', 0.5], ['AM (L)', 0.3], ['ST (C)', 0.2]],
  'AM (L)': [['M (L)', 0.5], ['AM (R)', 0.3], ['ST (C)', 0.2]],
  'ST (C)': [['AM (C)', 0.3], ['AM (L)', 0.15], ['AM (R)', 0.15]],
}

const HEIGHT: Record<PositionGroup, [number, number]> = {
  GK: [190, 4], CB: [188, 4], FB: [178, 5], DM: [181, 5], CM: [179, 5], AM: [176, 5], W: [175, 5], ST: [183, 6],
}

const SHIRTS: Record<string, number[]> = {
  GK: [1, 13, 31, 25, 40],
  'D (C)': [4, 5, 6, 3, 15, 24, 33, 2],
  'D (R)': [2, 12, 22, 27],
  'D (L)': [3, 18, 26, 29],
  DM: [6, 5, 16, 8],
  'M (C)': [8, 14, 16, 20, 21, 23],
  'AM (C)': [10, 19, 28, 17],
  'AM (R)': [7, 11, 17, 27],
  'AM (L)': [11, 7, 19, 24],
  'ST (C)': [9, 19, 39, 20, 29],
}

/** Typical per-90 rates for each position group (sample-model assumptions). */
type Base = {
  npxg: number; shots: number; sotPct: number; xag: number; kp: number; passAtt: number; passPct: number
  prog: number; final: number; crosses: number; touches: number; box: number; carry: number; progRec: number
  drib: number; dribPct: number; disp: number; tkl: number; int: number; blocks: number; clr: number
  recov: number; aer: number; aerPct: number; fouls: number; fouled: number; yel: number
}

const BASE: Record<Exclude<PositionGroup, 'GK'>, Base> = {
  ST: { npxg: 0.33, shots: 2.8, sotPct: 0.38, xag: 0.1, kp: 0.9, passAtt: 22, passPct: 0.72, prog: 1.2, final: 1.4, crosses: 0.4, touches: 38, box: 5.5, carry: 1.3, progRec: 5.5, drib: 1.8, dribPct: 0.45, disp: 1.6, tkl: 0.5, int: 0.2, blocks: 0.25, clr: 0.4, recov: 2.5, aer: 5.0, aerPct: 0.48, fouls: 1.2, fouled: 1.4, yel: 0.12 },
  W: { npxg: 0.21, shots: 2.3, sotPct: 0.35, xag: 0.19, kp: 1.6, passAtt: 30, passPct: 0.77, prog: 2.5, final: 2.2, crosses: 2.5, touches: 50, box: 4.0, carry: 3.8, progRec: 7.5, drib: 4.0, dribPct: 0.45, disp: 1.9, tkl: 1.0, int: 0.4, blocks: 0.4, clr: 0.3, recov: 3.5, aer: 1.2, aerPct: 0.35, fouls: 1.0, fouled: 1.8, yel: 0.12 },
  AM: { npxg: 0.17, shots: 2.0, sotPct: 0.34, xag: 0.21, kp: 2.0, passAtt: 40, passPct: 0.8, prog: 4.5, final: 3.5, crosses: 1.2, touches: 58, box: 2.8, carry: 2.8, progRec: 6.0, drib: 2.5, dribPct: 0.5, disp: 1.4, tkl: 1.2, int: 0.5, blocks: 0.6, clr: 0.3, recov: 4.5, aer: 1.3, aerPct: 0.38, fouls: 1.1, fouled: 1.6, yel: 0.15 },
  CM: { npxg: 0.07, shots: 1.0, sotPct: 0.3, xag: 0.1, kp: 1.0, passAtt: 58, passPct: 0.86, prog: 6.0, final: 4.6, crosses: 0.5, touches: 70, box: 0.9, carry: 1.8, progRec: 2.5, drib: 1.0, dribPct: 0.55, disp: 0.8, tkl: 2.0, int: 1.0, blocks: 1.0, clr: 0.9, recov: 6.0, aer: 1.7, aerPct: 0.47, fouls: 1.2, fouled: 1.1, yel: 0.2 },
  DM: { npxg: 0.04, shots: 0.6, sotPct: 0.28, xag: 0.06, kp: 0.6, passAtt: 62, passPct: 0.88, prog: 5.8, final: 4.4, crosses: 0.2, touches: 72, box: 0.4, carry: 1.0, progRec: 1.2, drib: 0.6, dribPct: 0.58, disp: 0.6, tkl: 2.3, int: 1.3, blocks: 1.2, clr: 1.5, recov: 7.0, aer: 2.5, aerPct: 0.52, fouls: 1.4, fouled: 1.0, yel: 0.25 },
  FB: { npxg: 0.03, shots: 0.5, sotPct: 0.28, xag: 0.1, kp: 0.9, passAtt: 48, passPct: 0.81, prog: 4.2, final: 3.4, crosses: 2.0, touches: 65, box: 0.8, carry: 2.5, progRec: 3.5, drib: 1.0, dribPct: 0.52, disp: 0.8, tkl: 2.0, int: 1.2, blocks: 1.0, clr: 2.2, recov: 5.5, aer: 1.8, aerPct: 0.5, fouls: 1.0, fouled: 1.0, yel: 0.17 },
  CB: { npxg: 0.05, shots: 0.6, sotPct: 0.27, xag: 0.02, kp: 0.2, passAtt: 60, passPct: 0.88, prog: 3.5, final: 2.6, crosses: 0.05, touches: 70, box: 0.5, carry: 0.7, progRec: 0.2, drib: 0.2, dribPct: 0.6, disp: 0.3, tkl: 1.4, int: 1.3, blocks: 1.5, clr: 4.5, recov: 5.0, aer: 3.9, aerPct: 0.66, fouls: 1.0, fouled: 0.6, yel: 0.17 },
}

interface Attrs {
  fin: number; shoot: number; create: number; pass: number; prog: number; drib: number
  carry: number; def: number; aerial: number; box: number; disc: number
}

interface Proto {
  player: Player
  peak: number
  attrs: Attrs
  ageAtCurrent: number
  history: Map<string, string> // season -> clubId
}

const ageCurve = (age: number) =>
  -0.025 * Math.pow(Math.max(0, 25 - age), 1.15) - 0.022 * Math.pow(Math.max(0, age - 30), 1.4)

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const CLUB_PREFIXES = new Set(['FC', 'CD', 'CF', 'UD', 'SD', 'SV', 'VfB', 'VfL', 'TSV', 'SC', 'AC', 'US', 'AS', 'SS', 'RC', 'FSV', 'SpVgg', '1.', 'Real', 'Atlético', 'Deportivo', 'Sporting', 'Racing', 'Club', 'Pro', 'Calcio', 'Unione', 'Virtus', 'Polisportiva', 'Atletico', 'Olympique', 'Stade', 'Union', 'En', 'Avant', 'Borussia', 'Eintracht', 'Fortuna', 'Rot-Weiß', 'Viktoria', 'Holstein', 'Arminia'])

function buildClubs(rng: Rng) {
  const leagues: League[] = []
  const clubs: Club[] = []
  const strength = new Map<string, number>()
  let colorIdx = 0
  for (const seed of LEAGUE_SEEDS) {
    leagues.push({ id: seed.id, name: seed.name, country: seed.country, nationCode: seed.nationCode, matchesPerSeason: MATCHES })
    seed.clubs.forEach((name, i) => {
      const words = name.split(' ')
      const core = words.filter((w) => !CLUB_PREFIXES.has(w))
      const main = (core[0] ?? words[words.length - 1]).replace(/[^A-Za-zÀ-ÿ]/g, '')
      const shortName = core.length ? core.join(' ') : name
      const abbr = main.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3).toUpperCase()
      const word = rng.pick(seed.stadiumWords)
      const suffix = ['Park', 'Road', 'Lane', 'Ground', 'Stadium', 'Arena', 'Stadion'].includes(word)
      const stadium = suffix ? `${main} ${word}` : `${word} ${main}`
      const id = slugify(name)
      clubs.push({
        id,
        name,
        shortName,
        abbr,
        leagueId: seed.id,
        colors: CLUB_COLORS[colorIdx++ % CLUB_COLORS.length],
        stadium,
        founded: rng.int(1874, 1932),
      })
      strength.set(id, clamp(seed.strength + 0.2 - (i * 0.4) / (seed.clubs.length - 1) + rng.normal(0, 0.03), 0.3, 1))
    })
  }
  return { leagues, clubs, strength }
}

function pickNation(rng: Rng, homeCode: string): NationPool {
  if (rng.chance(0.55)) return NATIONS.find((n) => n.code === homeCode)!
  return rng.pick(NATIONS)
}

function makeAttrs(rng: Rng, heightCm: number, group: PositionGroup): Attrs {
  const a = () => clamp(rng.normal(1, 0.2), 0.5, 1.7)
  const h = HEIGHT[group][0]
  return {
    fin: clamp(rng.normal(1, 0.12), 0.7, 1.35),
    shoot: a(), create: a(), pass: a(), prog: a(), drib: a(), carry: a(), def: a(),
    aerial: clamp(a() * (1 + (heightCm - h) * 0.025), 0.4, 1.9),
    box: a(), disc: a(),
  }
}

function generateLine(
  rng: Rng,
  proto: Proto,
  q: number,
  t: number,
  mins: number,
  pkTaker: boolean,
): StatLine {
  const { attrs } = proto
  const group = proto.player.group
  const n = mins / 90
  const sn = () => clamp(rng.normal(1, 0.08), 0.75, 1.25)
  const ta = 0.75 + 0.5 * t
  const td = 1.25 - 0.4 * t
  const tp = 0.85 + 0.3 * t
  const qm = 0.7 + 0.6 * q
  // A player's form varies from one season to the next.
  const form = clamp(rng.normal(1, 0.14), 0.65, 1.4)
  const creativeForm = clamp(rng.normal(1, 0.14), 0.65, 1.4)

  // Appearances from minutes.
  const starts = clamp(Math.floor((mins - 10) / 88), 0, MATCHES)
  const leftover = mins - starts * 88
  const subs = leftover > 0 ? Math.max(1, Math.round(leftover / 22)) : 0
  const apps = Math.min(MATCHES, starts + subs)

  const zero: StatLine = {
    apps, starts, mins, goals: 0, assists: 0, npg: 0, pkGoals: 0, pkAtt: 0, xg: 0, npxg: 0, xag: 0,
    shots: 0, sot: 0, passCmp: 0, passAtt: 0, progPasses: 0, keyPasses: 0, finalThirdPasses: 0, crosses: 0,
    touches: 0, touchesBox: 0, progCarries: 0, progRec: 0, dribblesAtt: 0, dribblesSucc: 0, dispossessed: 0,
    tackles: 0, tacklesWon: 0, interceptions: 0, blocks: 0, clearances: 0, recoveries: 0, aerialsWon: 0,
    aerialsLost: 0, errors: 0, fouls: 0, fouled: 0, yellows: 0, reds: 0, sca: 0, gca: 0,
    sotAgainst: 0, saves: 0, goalsAgainst: 0, cleanSheets: 0, psxg: 0, crossesFaced: 0, crossesStopped: 0,
    sweeperActions: 0, launches: 0,
  }

  if (group === 'GK') {
    const sotA90 = (5.0 - 2.2 * t) * clamp(rng.normal(1, 0.06), 0.8, 1.2)
    const savePct = clamp(0.68 + (q - 0.6) * 0.12 + rng.normal(0, 0.025), 0.55, 0.82)
    const sotAgainst = rng.poisson(sotA90 * n)
    const goalsAgainst = rng.binomial(sotAgainst, 1 - savePct)
    const gaPerMatch = goalsAgainst / Math.max(n, 1)
    const passAtt = rng.poisson(30 * tp * n)
    const crossesFaced = rng.poisson(9.5 * n * (1.2 - 0.4 * t))
    return {
      ...zero,
      sotAgainst,
      goalsAgainst,
      saves: sotAgainst - goalsAgainst,
      psxg: round1(sotAgainst * clamp(rng.normal(0.32, 0.02), 0.26, 0.38)),
      cleanSheets: rng.binomial(starts, clamp(Math.exp(-gaPerMatch) * 1.05, 0.05, 0.6)),
      crossesFaced,
      crossesStopped: rng.binomial(crossesFaced, clamp(rng.normal(0.075 + (attrs.aerial - 1) * 0.03, 0.015), 0.02, 0.16)),
      sweeperActions: rng.poisson(n * clamp(rng.normal(0.9, 0.3), 0.2, 2) * attrs.carry),
      passAtt,
      passCmp: rng.binomial(passAtt, clamp(0.72 + 0.15 * (t - 0.5) + (attrs.pass - 1) * 0.08 + rng.normal(0, 0.03), 0.5, 0.92)),
      launches: rng.binomial(passAtt, clamp(0.4 - 0.3 * (t - 0.5) - (attrs.pass - 1) * 0.15, 0.08, 0.8)),
      touches: rng.poisson(38 * tp * n),
      recoveries: rng.poisson(0.6 * n),
      yellows: rng.poisson(0.03 * n),
      errors: rng.poisson((0.06 - 0.04 * q) * n),
      fouls: rng.poisson(0.05 * n),
    }
  }

  const B = BASE[group]
  const npxgF = B.npxg * Math.sqrt(attrs.shoot) * attrs.box * qm * ta * form * sn() * n
  const npg = rng.poisson(npxgF * attrs.fin * clamp(rng.normal(1, 0.1), 0.7, 1.3))
  const pkAtt = pkTaker ? rng.poisson(0.11 * n * ta) : rng.poisson(0.004 * n)
  const pkGoals = rng.binomial(pkAtt, 0.78)
  const shots = Math.max(npg, rng.poisson(B.shots * attrs.shoot * Math.sqrt(qm) * ta * sn() * n))
  const sotPct = clamp(B.sotPct + (attrs.fin - 1) * 0.15 + rng.normal(0, 0.04), 0.15, 0.65)
  const sot = Math.min(shots, Math.max(npg, rng.binomial(shots, sotPct)))
  const xagF = B.xag * attrs.create * qm * ta * creativeForm * sn() * n
  const assists = rng.poisson(xagF * clamp(rng.normal(1, 0.15), 0.6, 1.5))
  const keyPasses = Math.max(assists, rng.poisson(B.kp * attrs.create * Math.pow(qm, 0.7) * ta * sn() * n))
  const passAtt = rng.poisson(B.passAtt * Math.pow(attrs.pass, 0.5) * tp * sn() * n)
  const passPct = clamp(B.passPct + (attrs.pass - 1) * 0.06 + (q - 0.6) * 0.08 + (t - 0.6) * 0.06 + rng.normal(0, 0.012), 0.5, 0.95)
  const dribblesAtt = rng.poisson(B.drib * attrs.drib * sn() * n)
  const dribPct = clamp(B.dribPct + (attrs.drib - 1) * 0.05 + (q - 0.6) * 0.1 + rng.normal(0, 0.03), 0.2, 0.8)
  const dribblesSucc = rng.binomial(dribblesAtt, dribPct)
  const tackles = rng.poisson(B.tkl * attrs.def * td * sn() * n)
  const aerialAtt = rng.poisson(B.aer * attrs.aerial * sn() * n)
  const aerialPct = clamp(B.aerPct + (attrs.aerial - 1) * 0.12 + rng.normal(0, 0.04), 0.15, 0.85)
  const aerialsWon = rng.binomial(aerialAtt, aerialPct)
  const fouled = rng.poisson(B.fouled * Math.pow(attrs.drib, 0.7) * sn() * n)
  const goals = npg + pkGoals

  return {
    ...zero,
    goals,
    assists,
    npg,
    pkGoals,
    pkAtt,
    npxg: round1(npxgF),
    xg: round1(npxgF + 0.76 * pkAtt),
    xag: round1(xagF),
    shots,
    sot,
    passAtt,
    passCmp: rng.binomial(passAtt, passPct),
    progPasses: rng.poisson(B.prog * attrs.prog * Math.pow(qm, 0.6) * tp * sn() * n),
    keyPasses,
    finalThirdPasses: rng.poisson(B.final * attrs.prog * tp * sn() * n),
    crosses: rng.poisson(B.crosses * Math.sqrt(attrs.create) * sn() * n),
    touches: rng.poisson(B.touches * tp * Math.pow(attrs.pass, 0.3) * sn() * n),
    touchesBox: rng.poisson(B.box * attrs.box * ta * sn() * n),
    progCarries: rng.poisson(B.carry * attrs.carry * Math.pow(qm, 0.6) * tp * sn() * n),
    progRec: rng.poisson(B.progRec * Math.sqrt(attrs.box) * Math.pow(attrs.carry, 0.3) * ta * sn() * n),
    dribblesAtt,
    dribblesSucc,
    dispossessed: rng.poisson(B.disp * Math.sqrt(attrs.drib) * ((2 - q) / 1.4) * sn() * n),
    tackles,
    tacklesWon: rng.binomial(tackles, clamp(rng.normal(0.58, 0.05), 0.4, 0.75)),
    interceptions: rng.poisson(B.int * attrs.def * td * sn() * n),
    blocks: rng.poisson(B.blocks * Math.sqrt(attrs.def) * td * sn() * n),
    clearances: rng.poisson(B.clr * Math.sqrt(attrs.aerial) * td * sn() * n),
    recoveries: rng.poisson(B.recov * Math.sqrt(attrs.def) * sn() * n),
    aerialsWon,
    aerialsLost: aerialAtt - aerialsWon,
    errors: rng.poisson(0.03 * (1.4 - q) * n),
    fouls: rng.poisson(B.fouls * attrs.disc * sn() * n),
    fouled,
    yellows: rng.poisson(B.yel * attrs.disc * n),
    reds: rng.poisson(0.004 * attrs.disc * n),
    sca: keyPasses + Math.round(shots * 0.25) + Math.round(dribblesSucc * 0.35) + Math.round(fouled * 0.15) + rng.poisson(0.1 * n * ta),
    gca: assists + rng.poisson(goals * 0.12 + 0.03 * n * attrs.create),
  }
}

export function generateSampleDataset(seed = 20251): Dataset {
  const rng = createRng(seed)
  const { leagues, clubs, strength } = buildClubs(rng)
  const clubById = new Map(clubs.map((c) => [c.id, c]))
  const usedNames = new Set<string>()
  const protos: Proto[] = []

  // 1. Build the current squads.
  for (const club of clubs) {
    const league = leagues.find((l) => l.id === club.leagueId)!
    const s = strength.get(club.id)!
    const usedShirts = new Set<number>()
    const depth = new Map<Position, number>()

    for (const pos of SQUAD_TEMPLATE) {
      const group = GROUP_OF[pos]
      const d = depth.get(pos) ?? 0
      depth.set(pos, d + 1)

      const nation = pickNation(rng, league.nationCode)
      let first = ''
      let last = ''
      let name = ''
      for (let tries = 0; tries < 50; tries++) {
        first = rng.pick(nation.first)
        last = rng.pick(nation.last)
        name = `${first} ${last}`
        if (!usedNames.has(name)) break
      }
      usedNames.add(name)

      const age = Math.round(clamp(rng.normal(25.5, 4), 17, 36))
      const q = clamp(s + rng.normal(0, 0.07) - d * 0.06, 0.2, 1)
      const peak = q - ageCurve(age)

      const [hMean, hSd] = HEIGHT[group]
      const heightCm = Math.round(clamp(rng.normal(hMean, hSd), 163, 203))

      const secondaryPositions: Position[] = []
      for (const [p, prob] of SECONDARY[pos] ?? []) if (rng.chance(prob)) secondaryPositions.push(p)

      let foot: Player['foot'] = rng.chance(0.04) ? 'Either' : rng.chance(0.79) ? 'Right' : 'Left'
      if (pos === 'D (L)') foot = rng.chance(0.85) ? 'Left' : 'Right'
      if (pos === 'AM (L)') foot = rng.chance(0.5) ? 'Left' : 'Right'
      if (pos === 'AM (R)') foot = rng.chance(0.4) ? 'Left' : 'Right'

      let shirtNumber = (SHIRTS[pos] ?? []).find((num) => !usedShirts.has(num)) ?? 0
      while (!shirtNumber || usedShirts.has(shirtNumber)) shirtNumber = rng.int(14, 49)
      usedShirts.add(shirtNumber)

      const birthYear = CURRENT_START_YEAR - age - (rng.chance(0.42) ? 1 : 0)
      const month = rng.int(1, 12)
      const day = rng.int(1, 28)
      const birthDate = `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      // age on 1 August of the current season
      const ageAtCurrent = CURRENT_START_YEAR - birthYear - (month >= 8 ? 1 : 0)

      let id = slugify(name)
      if (protos.some((p) => p.player.id === id)) id = `${id}-${protos.length}`

      const player: Player = {
        id,
        name,
        firstName: first,
        lastName: last,
        birthDate,
        nationCode: nation.code,
        heightCm,
        foot,
        primaryPosition: pos,
        secondaryPositions,
        group,
        clubId: club.id,
        shirtNumber,
        contractUntil: rng.int(2026, 2031),
      }
      protos.push({ player, peak, attrs: makeAttrs(rng, heightCm, group), ageAtCurrent, history: new Map() })
    }
  }

  // 2. Build each player's club history, working backwards from today.
  for (const proto of protos) {
    let club = proto.player.clubId
    let stay = rng.int(1, 4)
    for (let i = SEASONS.length - 1; i >= 0; i--) {
      const season = SEASONS[i]
      const age = proto.ageAtCurrent - (CURRENT_START_YEAR - seasonStartYear(season))
      const qa = proto.peak + ageCurve(age)
      if (age < 17 || (age < 18 && qa < 0.55)) break
      if (stay <= 0) {
        // Move to a club that matches the player's level at that age.
        const candidates = clubs.filter((c) => c.id !== club && Math.abs(strength.get(c.id)! - (qa + 0.03)) < 0.12)
        club = candidates.length ? rng.pick(candidates).id : rng.pick(clubs).id
        stay = rng.int(1, 4)
      }
      proto.history.set(season, club)
      stay--
    }
  }

  // 3. Simulate playing time and statistics club-by-club, season-by-season.
  const playerSeasons: PlayerSeason[] = []
  for (const season of SEASONS) {
    const squads = new Map<string, Proto[]>()
    for (const proto of protos) {
      const c = proto.history.get(season)
      if (!c) continue
      if (!squads.has(c)) squads.set(c, [])
      squads.get(c)!.push(proto)
    }

    for (const [clubId, squad] of squads) {
      const t = strength.get(clubId)!
      const yearsBack = CURRENT_START_YEAR - seasonStartYear(season)
      const eff = new Map(
        squad.map((p) => {
          const age = p.ageAtCurrent - yearsBack
          return [p, { age, q: clamp(p.peak + ageCurve(age) + rng.normal(0, 0.04), 0.1, 1.1) }]
        }),
      )

      // Penalty taker: best finisher among attacking players.
      const attackers = squad.filter((p) => ['ST', 'AM', 'W'].includes(p.player.group))
      const pkTaker = attackers.sort((a, b) => b.attrs.fin * eff.get(b)!.q - a.attrs.fin * eff.get(a)!.q)[0]

      const byGroup = new Map<PositionGroup, Proto[]>()
      for (const p of squad) {
        if (!byGroup.has(p.player.group)) byGroup.set(p.player.group, [])
        byGroup.get(p.player.group)!.push(p)
      }

      for (const [group, members] of byGroup) {
        members.sort((a, b) => eff.get(b)!.q - eff.get(a)!.q)
        const slots = STARTER_SLOTS[group]
        let remaining = slots * FULL_SEASON_MINS * 0.97
        members.forEach((p, rank) => {
          const { age, q } = eff.get(p)!
          const injured = rng.chance(0.15)
          const availability = injured ? rng.range(0.3, 0.65) : rng.range(0.75, 1)
          let cap = FULL_SEASON_MINS * availability
          if (age < 19) cap = Math.min(cap, rng.range(100, 1400))
          let mins = Math.min(cap, rank < slots ? remaining : remaining * 0.7)
          if (rank >= slots) mins = Math.min(mins, rng.range(150, 1700))
          if (group === 'GK' && rank >= 1) mins = Math.min(mins, rng.chance(0.5) ? 0 : rng.range(90, 900))
          mins = Math.max(0, Math.round(mins))
          remaining -= mins
          if (mins <= 0) return
          playerSeasons.push({
            playerId: p.player.id,
            season,
            clubId,
            leagueId: clubById.get(clubId)!.leagueId,
            age,
            stats: generateLine(rng, p, q, t, mins, p === pkTaker),
          })
        })
      }
    }
  }

  return {
    isSample: true,
    sourceName: 'Pitchside sample data (fictional, generated)',
    seasons: SEASONS,
    currentSeason: CURRENT_SEASON,
    nations: NATIONS.map(({ code, name, flag }) => ({ code, name, flag })),
    leagues,
    clubs,
    players: protos.map((p) => p.player),
    playerSeasons,
  }
}
