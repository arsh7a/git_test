import type { PositionGroup, StatLine } from './types'

// Every statistic the site can display, described once. Tables, percentile
// bars, radars and comparisons all read from this list.

export type MetricFormat = 'int' | 'dec1' | 'dec2' | 'pct'

export type MetricCategory =
  | 'Playing time'
  | 'Shooting'
  | 'Creation'
  | 'Passing'
  | 'Possession'
  | 'Defending'
  | 'Discipline'
  | 'Goalkeeping'

export interface Metric {
  id: string
  label: string
  short: string
  category: MetricCategory
  description: string
  format: MetricFormat
  /** Can be expressed "per 90 minutes" (counting stats). */
  per90: boolean
  /** True when a lower number is better (e.g. errors, goals conceded). */
  lowerIsBetter?: boolean
  /** Who this stat is meaningful for. */
  scope: 'outfield' | 'gk' | 'all'
  /** Calculates the season total (or the rate, for percentages). */
  value: (s: StatLine) => number | null
  /** Minimum volume needed before a percentage is meaningful. */
  minVolume?: (s: StatLine) => boolean
}

const pct = (a: number, b: number) => (b > 0 ? a / b : null)

export const METRICS: Metric[] = [
  // Playing time
  { id: 'apps', label: 'Appearances', short: 'MP', category: 'Playing time', description: 'Matches played, as a starter or substitute.', format: 'int', per90: false, scope: 'all', value: (s) => s.apps },
  { id: 'starts', label: 'Starts', short: 'Starts', category: 'Playing time', description: 'Matches started.', format: 'int', per90: false, scope: 'all', value: (s) => s.starts },
  { id: 'mins', label: 'Minutes', short: 'Min', category: 'Playing time', description: 'Total minutes played.', format: 'int', per90: false, scope: 'all', value: (s) => s.mins },
  { id: 'nineties', label: '90s played', short: '90s', category: 'Playing time', description: 'Minutes divided by 90 — the number of "full matches" played.', format: 'dec1', per90: false, scope: 'all', value: (s) => s.mins / 90 },

  // Shooting
  { id: 'goals', label: 'Goals', short: 'Gls', category: 'Shooting', description: 'Goals scored, including penalties.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.goals },
  { id: 'npg', label: 'Non-penalty goals', short: 'npG', category: 'Shooting', description: 'Goals scored, excluding penalties.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.npg },
  { id: 'pkGoals', label: 'Penalties scored', short: 'PK', category: 'Shooting', description: 'Penalty kicks scored.', format: 'int', per90: false, scope: 'outfield', value: (s) => s.pkGoals },
  { id: 'xg', label: 'Expected goals', short: 'xG', category: 'Shooting', description: 'Expected goals (xG): how many goals an average player would score from the same chances, including penalties.', format: 'dec1', per90: true, scope: 'outfield', value: (s) => s.xg },
  { id: 'npxg', label: 'Non-penalty xG', short: 'npxG', category: 'Shooting', description: 'Expected goals excluding penalties — a measure of the quality of chances a player gets.', format: 'dec1', per90: true, scope: 'outfield', value: (s) => s.npxg },
  { id: 'shots', label: 'Shots', short: 'Sh', category: 'Shooting', description: 'Total shots, excluding penalties.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.shots },
  { id: 'sot', label: 'Shots on target', short: 'SoT', category: 'Shooting', description: 'Shots that would have gone in without a save.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.sot },
  { id: 'sotPct', label: 'Shot accuracy', short: 'SoT%', category: 'Shooting', description: 'Percentage of shots that were on target.', format: 'pct', per90: false, scope: 'outfield', value: (s) => pct(s.sot, s.shots), minVolume: (s) => s.shots >= 10 },
  { id: 'goalsPerShot', label: 'Goals per shot', short: 'G/Sh', category: 'Shooting', description: 'Non-penalty goals divided by shots — finishing efficiency.', format: 'dec2', per90: false, scope: 'outfield', value: (s) => pct(s.npg, s.shots), minVolume: (s) => s.shots >= 10 },
  { id: 'npxgPerShot', label: 'npxG per shot', short: 'xG/Sh', category: 'Shooting', description: 'Average quality of each shot taken.', format: 'dec2', per90: false, scope: 'outfield', value: (s) => pct(s.npxg, s.shots), minVolume: (s) => s.shots >= 10 },
  { id: 'gMinusXg', label: 'Goals minus xG', short: 'G−xG', category: 'Shooting', description: 'Non-penalty goals minus non-penalty xG. Positive means scoring more than the chances suggest.', format: 'dec1', per90: false, scope: 'outfield', value: (s) => s.npg - s.npxg },

  // Creation
  { id: 'assists', label: 'Assists', short: 'Ast', category: 'Creation', description: 'Final pass before a goal.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.assists },
  { id: 'ga', label: 'Goals + assists', short: 'G+A', category: 'Creation', description: 'Goals plus assists.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.goals + s.assists },
  { id: 'xag', label: 'Expected assisted goals', short: 'xAG', category: 'Creation', description: 'The xG of shots that a player\'s passes set up — rewards creating good chances, whether or not they are scored.', format: 'dec1', per90: true, scope: 'outfield', value: (s) => s.xag },
  { id: 'npxgXag', label: 'npxG + xAG', short: 'npxG+xAG', category: 'Creation', description: 'Total expected goal involvement: chances taken plus chances created.', format: 'dec1', per90: true, scope: 'outfield', value: (s) => s.npxg + s.xag },
  { id: 'keyPasses', label: 'Key passes', short: 'KP', category: 'Creation', description: 'Passes that directly lead to a shot.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.keyPasses },
  { id: 'sca', label: 'Shot-creating actions', short: 'SCA', category: 'Creation', description: 'The two attacking actions (passes, dribbles, fouls drawn) directly leading to a shot.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.sca },
  { id: 'gca', label: 'Goal-creating actions', short: 'GCA', category: 'Creation', description: 'The two attacking actions directly leading to a goal.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.gca },

  // Passing
  { id: 'passCmp', label: 'Passes completed', short: 'Cmp', category: 'Passing', description: 'Successful passes.', format: 'int', per90: true, scope: 'all', value: (s) => s.passCmp },
  { id: 'passAtt', label: 'Passes attempted', short: 'Att', category: 'Passing', description: 'All passes attempted.', format: 'int', per90: true, scope: 'all', value: (s) => s.passAtt },
  { id: 'passPct', label: 'Pass completion', short: 'Cmp%', category: 'Passing', description: 'Percentage of passes that reached a teammate.', format: 'pct', per90: false, scope: 'all', value: (s) => pct(s.passCmp, s.passAtt), minVolume: (s) => s.passAtt >= 150 },
  { id: 'progPasses', label: 'Progressive passes', short: 'PrgP', category: 'Passing', description: 'Passes that move the ball significantly towards the opponent\'s goal.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.progPasses },
  { id: 'finalThirdPasses', label: 'Passes into final third', short: '1/3', category: 'Passing', description: 'Completed passes into the attacking third of the pitch.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.finalThirdPasses },
  { id: 'crosses', label: 'Crosses', short: 'Crs', category: 'Passing', description: 'Passes from wide areas into the penalty area.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.crosses },

  // Possession
  { id: 'touches', label: 'Touches', short: 'Touch', category: 'Possession', description: 'Number of times the player touched the ball.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.touches },
  { id: 'touchesBox', label: 'Touches in box', short: 'Att Pen', category: 'Possession', description: 'Touches inside the opponent\'s penalty area.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.touchesBox },
  { id: 'progCarries', label: 'Progressive carries', short: 'PrgC', category: 'Possession', description: 'Runs with the ball that move it significantly towards goal.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.progCarries },
  { id: 'progRec', label: 'Progressive receptions', short: 'PrgR', category: 'Possession', description: 'Progressive passes received — how often the player gets on the ball in dangerous areas.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.progRec },
  { id: 'dribblesSucc', label: 'Successful dribbles', short: 'Succ', category: 'Possession', description: 'Times the player beat an opponent with the ball.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.dribblesSucc },
  { id: 'dribblesAtt', label: 'Dribbles attempted', short: 'Att Drb', category: 'Possession', description: 'Attempts to beat an opponent with the ball.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.dribblesAtt },
  { id: 'dribblePct', label: 'Dribble success', short: 'Succ%', category: 'Possession', description: 'Percentage of dribbles that were successful.', format: 'pct', per90: false, scope: 'outfield', value: (s) => pct(s.dribblesSucc, s.dribblesAtt), minVolume: (s) => s.dribblesAtt >= 10 },
  { id: 'dispossessed', label: 'Dispossessed', short: 'Dis', category: 'Possession', description: 'Times the player lost the ball after being tackled.', format: 'int', per90: true, lowerIsBetter: true, scope: 'outfield', value: (s) => s.dispossessed },

  // Defending
  { id: 'tackles', label: 'Tackles', short: 'Tkl', category: 'Defending', description: 'Tackles made.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.tackles },
  { id: 'tacklesWon', label: 'Tackles won', short: 'TklW', category: 'Defending', description: 'Tackles where the player\'s team won possession.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.tacklesWon },
  { id: 'interceptions', label: 'Interceptions', short: 'Int', category: 'Defending', description: 'Opponent passes intercepted.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.interceptions },
  { id: 'tklInt', label: 'Tackles + interceptions', short: 'Tkl+Int', category: 'Defending', description: 'Tackles plus interceptions — a simple measure of defensive activity.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.tackles + s.interceptions },
  { id: 'blocks', label: 'Blocks', short: 'Blk', category: 'Defending', description: 'Shots or passes blocked.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.blocks },
  { id: 'clearances', label: 'Clearances', short: 'Clr', category: 'Defending', description: 'Balls cleared away from danger.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.clearances },
  { id: 'recoveries', label: 'Ball recoveries', short: 'Recov', category: 'Defending', description: 'Loose balls won back.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.recoveries },
  { id: 'aerialsWon', label: 'Aerial duels won', short: 'Aer W', category: 'Defending', description: 'Headers won against an opponent.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.aerialsWon },
  { id: 'aerialPct', label: 'Aerial win rate', short: 'Aer%', category: 'Defending', description: 'Percentage of aerial duels won.', format: 'pct', per90: false, scope: 'outfield', value: (s) => pct(s.aerialsWon, s.aerialsWon + s.aerialsLost), minVolume: (s) => s.aerialsWon + s.aerialsLost >= 15 },
  { id: 'errors', label: 'Errors leading to shot', short: 'Err', category: 'Defending', description: 'Mistakes that led directly to an opponent\'s shot.', format: 'int', per90: true, lowerIsBetter: true, scope: 'all', value: (s) => s.errors },

  // Discipline
  { id: 'fouls', label: 'Fouls committed', short: 'Fls', category: 'Discipline', description: 'Fouls committed.', format: 'int', per90: true, lowerIsBetter: true, scope: 'outfield', value: (s) => s.fouls },
  { id: 'fouled', label: 'Fouls drawn', short: 'Fld', category: 'Discipline', description: 'Times the player was fouled.', format: 'int', per90: true, scope: 'outfield', value: (s) => s.fouled },
  { id: 'yellows', label: 'Yellow cards', short: 'CrdY', category: 'Discipline', description: 'Yellow cards received.', format: 'int', per90: false, lowerIsBetter: true, scope: 'all', value: (s) => s.yellows },
  { id: 'reds', label: 'Red cards', short: 'CrdR', category: 'Discipline', description: 'Red cards received.', format: 'int', per90: false, lowerIsBetter: true, scope: 'all', value: (s) => s.reds },

  // Goalkeeping
  { id: 'goalsAgainst', label: 'Goals conceded', short: 'GA', category: 'Goalkeeping', description: 'Goals conceded while on the pitch.', format: 'int', per90: true, lowerIsBetter: true, scope: 'gk', value: (s) => s.goalsAgainst },
  { id: 'sotAgainst', label: 'Shots on target faced', short: 'SoTA', category: 'Goalkeeping', description: 'Shots on target the goalkeeper faced.', format: 'int', per90: true, scope: 'gk', value: (s) => s.sotAgainst },
  { id: 'saves', label: 'Saves', short: 'Saves', category: 'Goalkeeping', description: 'Shots on target saved.', format: 'int', per90: true, scope: 'gk', value: (s) => s.saves },
  { id: 'savePct', label: 'Save percentage', short: 'Save%', category: 'Goalkeeping', description: 'Percentage of shots on target saved.', format: 'pct', per90: false, scope: 'gk', value: (s) => pct(s.saves, s.sotAgainst), minVolume: (s) => s.sotAgainst >= 20 },
  { id: 'cleanSheets', label: 'Clean sheets', short: 'CS', category: 'Goalkeeping', description: 'Matches started without conceding.', format: 'int', per90: false, scope: 'gk', value: (s) => s.cleanSheets },
  { id: 'csPct', label: 'Clean sheet rate', short: 'CS%', category: 'Goalkeeping', description: 'Percentage of starts with a clean sheet.', format: 'pct', per90: false, scope: 'gk', value: (s) => pct(s.cleanSheets, s.starts), minVolume: (s) => s.starts >= 8 },
  { id: 'psxg', label: 'Post-shot xG faced', short: 'PSxG', category: 'Goalkeeping', description: 'How many goals an average keeper would concede from the shots faced, based on where the shots were placed.', format: 'dec1', per90: true, scope: 'gk', value: (s) => s.psxg },
  { id: 'psxgDiff', label: 'Goals prevented', short: 'PSxG±', category: 'Goalkeeping', description: 'Post-shot xG minus goals conceded. Positive means the keeper saved more than an average keeper would.', format: 'dec1', per90: true, scope: 'gk', value: (s) => s.psxg - s.goalsAgainst },
  { id: 'crossStopPct', label: 'Crosses stopped', short: 'Stp%', category: 'Goalkeeping', description: 'Percentage of crosses into the box claimed or punched.', format: 'pct', per90: false, scope: 'gk', value: (s) => pct(s.crossesStopped, s.crossesFaced), minVolume: (s) => s.crossesFaced >= 40 },
  { id: 'sweeperActions', label: 'Sweeper actions', short: '#OPA', category: 'Goalkeeping', description: 'Defensive actions outside the penalty area.', format: 'int', per90: true, scope: 'gk', value: (s) => s.sweeperActions },
  { id: 'launchPct', label: 'Long kick rate', short: 'Launch%', category: 'Goalkeeping', description: 'Share of passes that were long balls. Neither good nor bad — it reflects playing style.', format: 'pct', per90: false, scope: 'gk', value: (s) => pct(s.launches, s.passAtt), minVolume: (s) => s.passAtt >= 150 },
]

export const METRIC = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<string, Metric>

/** Value as shown: per 90 for counting stats when `per90` is requested. */
export function metricValue(m: Metric, s: StatLine, per90: boolean): number | null {
  if (m.minVolume && !m.minVolume(s)) return null
  const v = m.value(s)
  if (v == null) return null
  if (per90 && m.per90) return s.mins > 0 ? v / (s.mins / 90) : null
  return v
}

export const GROUP_LABEL: Record<PositionGroup, string> = {
  GK: 'Goalkeepers',
  CB: 'Centre-backs',
  FB: 'Full-backs',
  DM: 'Defensive midfielders',
  CM: 'Central midfielders',
  AM: 'Attacking midfielders',
  W: 'Wingers',
  ST: 'Strikers',
}

export const GROUP_SHORT: Record<PositionGroup, string> = {
  GK: 'GK', CB: 'CB', FB: 'FB', DM: 'DM', CM: 'CM', AM: 'AM', W: 'W', ST: 'ST',
}

/** The 10 stats shown on each position's radar chart. */
export const RADAR_TEMPLATES: Record<PositionGroup, string[]> = {
  ST: ['npg', 'npxg', 'shots', 'npxgPerShot', 'xag', 'sca', 'dribblesSucc', 'touchesBox', 'aerialsWon', 'tklInt'],
  W: ['npg', 'npxg', 'xag', 'keyPasses', 'sca', 'progPasses', 'progCarries', 'dribblesSucc', 'touchesBox', 'tklInt'],
  AM: ['npg', 'npxg', 'xag', 'keyPasses', 'sca', 'progPasses', 'progCarries', 'dribblesSucc', 'touchesBox', 'tklInt'],
  CM: ['npxg', 'xag', 'keyPasses', 'progPasses', 'passPct', 'progCarries', 'dribblesSucc', 'tklInt', 'recoveries', 'aerialsWon'],
  DM: ['xag', 'progPasses', 'passPct', 'passCmp', 'progCarries', 'tackles', 'interceptions', 'blocks', 'recoveries', 'aerialPct'],
  FB: ['xag', 'crosses', 'progPasses', 'progCarries', 'dribblesSucc', 'passPct', 'tklInt', 'blocks', 'clearances', 'aerialsWon'],
  CB: ['passPct', 'progPasses', 'progCarries', 'tackles', 'interceptions', 'blocks', 'clearances', 'aerialsWon', 'aerialPct', 'recoveries'],
  GK: ['savePct', 'psxgDiff', 'csPct', 'saves', 'crossStopPct', 'sweeperActions', 'passPct', 'goalsAgainst'],
}

/** Stats used in the percentile ("scouting report") panel, grouped by category. */
export const SCOUT_TEMPLATE_OUTFIELD: { category: string; metrics: string[] }[] = [
  { category: 'Shooting', metrics: ['npg', 'npxg', 'shots', 'sotPct', 'npxgPerShot'] },
  { category: 'Creation', metrics: ['assists', 'xag', 'keyPasses', 'sca', 'gca'] },
  { category: 'Passing', metrics: ['passCmp', 'passPct', 'progPasses', 'finalThirdPasses', 'crosses'] },
  { category: 'Possession', metrics: ['touches', 'touchesBox', 'progCarries', 'progRec', 'dribblesSucc', 'dribblePct', 'dispossessed'] },
  { category: 'Defending', metrics: ['tackles', 'interceptions', 'blocks', 'clearances', 'recoveries', 'aerialsWon', 'aerialPct'] },
]

export const SCOUT_TEMPLATE_GK: { category: string; metrics: string[] }[] = [
  { category: 'Shot stopping', metrics: ['savePct', 'psxgDiff', 'goalsAgainst', 'saves', 'csPct'] },
  { category: 'Command & sweeping', metrics: ['crossStopPct', 'sweeperActions'] },
  { category: 'Distribution', metrics: ['passCmp', 'passPct', 'launchPct'] },
]

/** Stat-table column sets used by the Statistics database. */
export const TABLE_VIEWS: { id: string; label: string; metrics: string[]; gkOnly?: boolean }[] = [
  { id: 'standard', label: 'Standard', metrics: ['apps', 'starts', 'mins', 'goals', 'assists', 'ga', 'npg', 'pkGoals', 'xg', 'npxg', 'xag', 'npxgXag', 'yellows', 'reds'] },
  { id: 'shooting', label: 'Shooting', metrics: ['mins', 'goals', 'shots', 'sot', 'sotPct', 'goalsPerShot', 'npxg', 'npxgPerShot', 'gMinusXg'] },
  { id: 'passing', label: 'Passing', metrics: ['mins', 'passCmp', 'passAtt', 'passPct', 'progPasses', 'keyPasses', 'finalThirdPasses', 'crosses', 'xag', 'assists'] },
  { id: 'creation', label: 'Chance creation', metrics: ['mins', 'sca', 'gca', 'keyPasses', 'xag', 'assists', 'fouled'] },
  { id: 'possession', label: 'Possession', metrics: ['mins', 'touches', 'touchesBox', 'progCarries', 'progRec', 'dribblesAtt', 'dribblesSucc', 'dribblePct', 'dispossessed'] },
  { id: 'defending', label: 'Defending', metrics: ['mins', 'tackles', 'tacklesWon', 'interceptions', 'tklInt', 'blocks', 'clearances', 'recoveries', 'aerialsWon', 'aerialPct', 'errors'] },
  { id: 'goalkeeping', label: 'Goalkeeping', metrics: ['apps', 'mins', 'goalsAgainst', 'sotAgainst', 'saves', 'savePct', 'cleanSheets', 'csPct', 'psxg', 'psxgDiff', 'crossStopPct', 'sweeperActions', 'launchPct'], gkOnly: true },
]
