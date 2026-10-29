import type { StatKey, StatLine } from './types'

/** A season line with every stat at zero. Data sources fill in what they measure. */
export const EMPTY_LINE: StatLine = {
  apps: 0, starts: 0, mins: 0, goals: 0, assists: 0, npg: 0, pkGoals: 0, pkAtt: 0, xg: 0, npxg: 0, xag: 0,
  shots: 0, sot: 0, passCmp: 0, passAtt: 0, progPasses: 0, keyPasses: 0, finalThirdPasses: 0, crosses: 0,
  touches: 0, touchesBox: 0, progCarries: 0, progRec: 0, dribblesAtt: 0, dribblesSucc: 0, dispossessed: 0,
  tackles: 0, tacklesWon: 0, interceptions: 0, blocks: 0, clearances: 0, recoveries: 0, aerialsWon: 0,
  aerialsLost: 0, errors: 0, fouls: 0, fouled: 0, yellows: 0, reds: 0, sca: 0, gca: 0, duels: 0, duelsWon: 0,
  ratingMins: 0, sotAgainst: 0, saves: 0, goalsAgainst: 0, cleanSheets: 0, psxg: 0, crossesFaced: 0,
  crossesStopped: 0, sweeperActions: 0, launches: 0,
}

export const STAT_KEYS = Object.keys(EMPTY_LINE) as StatKey[]
