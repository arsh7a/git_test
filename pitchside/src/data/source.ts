import { generateSampleDataset } from './sample/generate'
import type { Dataset } from './types'

// Picks the data the site runs on. `npm run build:data` writes real data to
// src/data/real/dataset.json; when that file is missing, the generated sample
// data is used instead. The real file is not committed (see README).
const real = Object.values(import.meta.glob<Dataset>('./real/dataset.json', { eager: true, import: 'default' }))[0]

export const dataset: Dataset = real ?? generateSampleDataset()

/** The data provider's logo, when its terms ask for one to be shown (saved by the data script). */
export const sourceLogo: string | undefined = real
  ? Object.values(import.meta.glob<string>('./real/source-logo.png', { eager: true, query: '?url', import: 'default' }))[0]
  : undefined
