import { generateSampleDataset } from './sample/generate'
import type { Dataset, PackedDataset, PlayerSeason, StatLine } from './types'

// Picks the data the site runs on. `npm run build:data` writes real data to
// src/data/real/dataset.json; when that file is missing, the generated sample
// data is used instead. The real file is not committed (see README).
const real = Object.values(import.meta.glob<Dataset | PackedDataset>('./real/dataset.json', { eager: true, import: 'default' }))[0]

/** Unpacks season rows; a stat the source did not measure becomes NaN, which every display shows as "—". */
function unpack(d: Dataset | PackedDataset): Dataset {
  if (!('packedRows' in d)) return d
  const { statKeys, packedRows, ...rest } = d
  const playerSeasons: PlayerSeason[] = packedRows.map(([playerId, season, clubId, leagueId, age, ...values]) => {
    const stats = {} as StatLine
    statKeys.forEach((k, i) => (stats[k] = values[i] == null ? NaN : (values[i] as number)))
    return { playerId: playerId as string, season: season as string, clubId: clubId as string, leagueId: leagueId as string, age: (age as number | null) ?? undefined, stats }
  })
  return { ...rest, playerSeasons }
}

export const dataset: Dataset = real ? unpack(real) : generateSampleDataset()

/** The data provider's logo, when its terms ask for one to be shown (saved by the data script). */
export const sourceLogo: string | undefined = real
  ? Object.values(import.meta.glob<string>('./real/source-logo.png', { eager: true, query: '?url', import: 'default' }))[0]
  : undefined
