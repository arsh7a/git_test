// The shape of all football data used by the site.
// Any future real data source only needs to produce a `Dataset` in this shape.

export type PositionGroup = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST'

export type Position =
  | 'GK'
  | 'D (L)'
  | 'D (C)'
  | 'D (R)'
  | 'WB (L)'
  | 'WB (R)'
  | 'DM'
  | 'M (L)'
  | 'M (C)'
  | 'M (R)'
  | 'AM (L)'
  | 'AM (C)'
  | 'AM (R)'
  | 'ST (C)'

export interface Nation {
  code: string // three-letter code, e.g. "ENG"
  name: string
  flag: FlagSpec
}

export type FlagSpec =
  | { kind: 'h' | 'v'; colors: string[]; weights?: number[] }
  | { kind: 'nordic'; bg: string; cross: string; inner?: string }
  | { kind: 'stgeorge'; bg: string; cross: string }
  | { kind: 'disc'; bg: string; disc: string }
  | { kind: 'diamond'; bg: string; diamond: string; disc: string }

export interface League {
  id: string
  name: string
  country: string
  nationCode: string
  matchesPerSeason: number
}

export interface Club {
  id: string
  name: string
  shortName: string
  abbr: string
  leagueId: string
  colors: [string, string]
  stadium: string
  founded: number
}

export interface Player {
  id: string
  name: string
  firstName: string
  lastName: string
  birthDate: string // YYYY-MM-DD
  nationCode: string
  heightCm: number
  foot: 'Right' | 'Left' | 'Either'
  primaryPosition: Position
  secondaryPositions: Position[]
  group: PositionGroup
  clubId: string // current club
  shirtNumber: number
  contractUntil: number
}

/** Raw season totals. Rates (percentages, per 90s) are calculated from these. */
export interface StatLine {
  apps: number
  starts: number
  mins: number
  goals: number
  assists: number
  npg: number
  pkGoals: number
  pkAtt: number
  xg: number
  npxg: number
  xag: number
  shots: number
  sot: number
  passCmp: number
  passAtt: number
  progPasses: number
  keyPasses: number
  finalThirdPasses: number
  crosses: number
  touches: number
  touchesBox: number
  progCarries: number
  progRec: number
  dribblesAtt: number
  dribblesSucc: number
  dispossessed: number
  tackles: number
  tacklesWon: number
  interceptions: number
  blocks: number
  clearances: number
  recoveries: number
  aerialsWon: number
  aerialsLost: number
  errors: number
  fouls: number
  fouled: number
  yellows: number
  reds: number
  sca: number
  gca: number
  // Goalkeeping
  sotAgainst: number
  saves: number
  goalsAgainst: number
  cleanSheets: number
  psxg: number
  crossesFaced: number
  crossesStopped: number
  sweeperActions: number
  launches: number
}

export type StatKey = keyof StatLine

export interface PlayerSeason {
  playerId: string
  season: string // e.g. "2025-26"
  clubId: string
  leagueId: string
  age: number
  stats: StatLine
}

export interface Dataset {
  /** True while the site runs on generated sample data. */
  isSample: boolean
  sourceName: string
  seasons: string[] // oldest first
  currentSeason: string
  nations: Nation[]
  leagues: League[]
  clubs: Club[]
  players: Player[]
  playerSeasons: PlayerSeason[]
}
