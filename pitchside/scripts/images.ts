// Downloads club crests and player photos listed by `npm run data:build`,
// shrinks them and packs them into src/data/real/images-*.json, which the
// site loads after the page appears.
//
//   npm run data:images
//
// For each club or player it tries PitchAPI's image first, then the freely
// licensed Wikimedia Commons file found by `npm run data:wikidata` (those
// link to their Commons page for the author and licence). Downloads are
// cached in data-cache/images/, so re-running only fetches what is missing.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { USER_AGENT } from './wikidata.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache', 'images')
const LIST = join(ROOT, 'data-cache', 'build', 'images.json')
const OUT_DIR = join(ROOT, 'src', 'data', 'real')
const THUMB_WIDTH = 250 // one of Wikimedia's standard thumbnail sizes
const WORKERS = 6
const CHUNK_BYTES = 6_000_000 // keeps each packed file well under the 16 MB page-file limit

/** Commons thumbnail URL; the folder comes from the md5 of the file name. */
function commonsUrl(file: string) {
  const md5 = createHash('md5').update(file).digest('hex')
  const suffix = /\.svg$/i.test(file) ? '.png' : ''
  const name = encodeURIComponent(file)
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${name}/${THUMB_WIDTH}px-${name}${suffix}`
}

async function download(source: string): Promise<Buffer | null> {
  const url = source.startsWith('commons:') ? commonsUrl(source.slice(8)) : source
  const path = join(CACHE, createHash('md5').update(url).digest('hex'))
  if (existsSync(path)) return readFileSync(path)
  // Earlier versions cached Commons files under the md5 of the file name.
  const legacy = source.startsWith('commons:') ? join(CACHE, createHash('md5').update(source.slice(8)).digest('hex')) : ''
  if (legacy && existsSync(legacy)) return readFileSync(legacy)
  if (existsSync(path + '.missing')) return null
  for (let attempt = 1; attempt <= 5; attempt++) {
    // Commons asks for a gentle pace; PitchAPI's CDN is fine with the workers' pace.
    if (source.startsWith('commons:')) await new Promise((r) => setTimeout(r, 1000 * attempt ** 2))
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(path, buf)
      return buf
    }
    if (res.status === 404 || (res.status < 500 && res.status !== 429)) {
      writeFileSync(path + '.missing', '')
      return null
    }
    if (attempt === 5) return null
    await new Promise((r) => setTimeout(r, 2000 * attempt))
  }
  return null
}

async function main() {
  const list: { clubs: Record<string, string[]>; players: Record<string, string[]> } = JSON.parse(readFileSync(LIST, 'utf8'))
  mkdirSync(CACHE, { recursive: true })
  const jobs = (['clubs', 'players'] as const).flatMap((kind) => Object.entries(list[kind]).map(([id, sources]) => ({ kind, id, sources })))
  const picked = new Map<string, { kind: 'clubs' | 'players'; id: string; source: string; buf: Buffer }>()
  const hashes = new Map<string, number>()
  let done = 0

  const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      for (const source of job.sources) {
        const buf = await download(source)
        if (!buf) continue
        const hash = createHash('md5').update(buf).digest('hex')
        hashes.set(hash, (hashes.get(hash) ?? 0) + 1)
        picked.set(`${job.kind}:${job.id}`, { ...job, source, buf })
        break
      }
      if (++done % 500 === 0) console.log(`  ${done} checked`)
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))

  // A picture shared by many players is the provider's "no photo" placeholder: leave those to the drawn silhouette.
  const placeholder = (buf: Buffer) => (hashes.get(createHash('md5').update(buf).digest('hex')) ?? 0) > 5

  for (const f of readdirSync(OUT_DIR)) if (/^images(-\d+)?\.json$/.test(f)) unlinkSync(join(OUT_DIR, f))
  let chunk = { clubs: {} as Record<string, string>, players: {} as Record<string, string>, files: {} as Record<string, string> }
  let size = 0
  let n = 0
  const flush = () => {
    if (size) writeFileSync(join(OUT_DIR, `images-${n++}.json`), JSON.stringify(chunk))
    chunk = { clubs: {}, players: {}, files: {} }
    size = 0
  }
  const counts = { clubs: 0, players: 0, commons: 0 }
  for (const { kind, id, source, buf } of picked.values()) {
    if (placeholder(buf)) continue
    try {
      // Crests keep their shape on a transparent square; photos are cropped to the face area (top of the frame).
      const img =
        kind === 'clubs'
          ? sharp(buf).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80 })
          : sharp(buf).resize(96, 96, { fit: 'cover', position: 'north' }).webp({ quality: 70 })
      const uri = `data:image/webp;base64,${(await img.toBuffer()).toString('base64')}`
      chunk[kind][id] = uri
      if (source.startsWith('commons:')) {
        chunk.files[`${kind}:${id}`] = source.slice(8)
        counts.commons++
      }
      counts[kind]++
      size += uri.length
      if (size > CHUNK_BYTES) flush()
    } catch {
      // An image sharp cannot read is skipped.
    }
  }
  flush()
  console.log(`Packed ${counts.clubs} crests and ${counts.players} photos (${counts.commons} from Wikimedia Commons) into ${n} files`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
