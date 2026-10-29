// Downloads the club crests and player photos found by `npm run data:wikidata`
// from Wikimedia Commons, shrinks them, and packs them into
// src/data/real/images.json (loaded by the site after the page appears).
//
//   npm run data:images
//
// Only freely licensed Commons files are used. Each image links back to its
// Commons page, which names the author and licence. Downloads are cached in
// data-cache/images/, so re-running only fetches what is missing.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { USER_AGENT, type WikidataMatches } from './wikidata.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data-cache', 'images')
const MATCHES = join(ROOT, 'data-cache', 'wikidata', 'matches.json')
const OUT = join(ROOT, 'src', 'data', 'real', 'images.json')
const THUMB_WIDTH = 250 // one of Wikimedia's standard thumbnail sizes
const GAP_MS = 1000 // one request a second, to stay polite

class RateLimited extends Error {}

/** Commons thumbnail URL; the folder comes from the md5 of the file name. */
function thumbUrl(file: string) {
  const md5 = createHash('md5').update(file).digest('hex')
  const suffix = /\.svg$/i.test(file) ? '.png' : ''
  const name = encodeURIComponent(file)
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${name}/${THUMB_WIDTH}px-${name}${suffix}`
}

async function download(file: string): Promise<Buffer | null> {
  const path = join(CACHE, createHash('md5').update(file).digest('hex'))
  if (existsSync(path)) return readFileSync(path)
  for (let attempt = 1; attempt <= 5; attempt++) {
    await new Promise((r) => setTimeout(r, GAP_MS * attempt ** 2))
    const res = await fetch(thumbUrl(file), { headers: { 'User-Agent': USER_AGENT } })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(path, buf)
      return buf
    }
    if (res.status === 404) return null // e.g. image smaller than the thumbnail size
    if (res.status !== 429 && res.status < 500) return null
  }
  throw new RateLimited()
}

async function main() {
  const matches: WikidataMatches = JSON.parse(readFileSync(MATCHES, 'utf8'))
  mkdirSync(CACHE, { recursive: true })
  const out = { clubs: {} as Record<string, string>, players: {} as Record<string, string>, files: {} as Record<string, string> }
  const jobs = [
    ...Object.entries(matches.clubs).filter(([, c]) => c.logo).map(([id, c]) => ({ kind: 'clubs' as const, id, file: c.logo! })),
    ...Object.entries(matches.players).filter(([, p]) => p.photo).map(([id, p]) => ({ kind: 'players' as const, id, file: p.photo! })),
  ]
  let missing = 0
  try {
    for (const [i, job] of jobs.entries()) {
      const buf = await download(job.file)
      if (!buf) {
        missing++
        continue
      }
      // Crests keep their shape on a transparent square; photos are cropped to the face area (top of the frame).
      const img =
        job.kind === 'clubs'
          ? sharp(buf).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80 })
          : sharp(buf).resize(96, 96, { fit: 'cover', position: 'north' }).webp({ quality: 70 })
      out[job.kind][job.id] = `data:image/webp;base64,${(await img.toBuffer()).toString('base64')}`
      out.files[`${job.kind}:${job.id}`] = job.file
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1} of ${jobs.length}`)
    }
  } catch (e) {
    if (!(e instanceof RateLimited)) throw e
    console.log('Wikimedia is refusing requests from this connection (HTTP 429). Saved what was downloaded; run again later to continue.')
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out))
  console.log(`Packed ${Object.keys(out.clubs).length} crests and ${Object.keys(out.players).length} photos (${missing} unavailable) into ${OUT}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
