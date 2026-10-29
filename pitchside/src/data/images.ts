import { useSyncExternalStore } from 'react'

// Club crests and player photos (from `npm run data:images`). They are loaded
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

const loader = Object.values(import.meta.glob<ImageSet>('./real/images.json', { import: 'default' }))[0]
loader?.().then((set) => {
  images = set
  for (const l of listeners) l()
})

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
