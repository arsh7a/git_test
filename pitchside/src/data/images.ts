import { useSyncExternalStore } from 'react'

// Club crests and player photos (from `npm run data:images`, split over several files). They are loaded
// after the page appears, so the site never waits on them; until then, and for
// anyone without an image, the drawn badge or silhouette is shown.

interface ImageSet {
  clubs: Record<string, string>
  players: Record<string, string>
  /** Commons file name per "clubs:<id>" / "players:<id>", for the credit link. */
  files: Record<string, string>
}

let images: ImageSet | null = null
const listeners = new Set<() => void>()

// Each file is merged in as it arrives, so pictures appear progressively.
for (const load of Object.values(import.meta.glob<ImageSet>('./real/images-*.json', { import: 'default' }))) {
  load().then((set) => {
    images = {
      clubs: { ...images?.clubs, ...set.clubs },
      players: { ...images?.players, ...set.players },
      files: { ...images?.files, ...set.files },
    }
    for (const l of listeners) l()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export interface SourcedImage {
  src: string
  /** The image's Wikimedia Commons page, which credits its author and licence. */
  creditUrl: string
}

export function useImage(kind: 'clubs' | 'players', id: string): SourcedImage | undefined {
  const set = useSyncExternalStore(subscribe, () => images)
  const src = set?.[kind][id]
  if (!src) return undefined
  return { src, creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(set.files[`${kind}:${id}`])}` }
}
