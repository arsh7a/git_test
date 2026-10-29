// A tiny "seeded" random number generator. The same seed always produces the
// same sample data, so players keep the same stats every time the site loads.
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const range = (min: number, max: number) => min + next() * (max - min)
  const int = (min: number, max: number) => Math.floor(range(min, max + 1))
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]
  const chance = (p: number) => next() < p
  const normal = (mean = 0, sd = 1) => {
    const u = Math.max(next(), 1e-9)
    const v = next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const poisson = (lambda: number): number => {
    if (lambda <= 0) return 0
    if (lambda > 40) return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda))))
    const limit = Math.exp(-lambda)
    let k = 0
    let p = 1
    do {
      k++
      p *= next()
    } while (p > limit)
    return k - 1
  }
  const binomial = (n: number, p: number): number => {
    if (n <= 0) return 0
    if (n > 60) {
      const mean = n * p
      return Math.min(n, Math.max(0, Math.round(normal(mean, Math.sqrt(mean * (1 - p))))))
    }
    let k = 0
    for (let i = 0; i < n; i++) if (next() < p) k++
    return k
  }
  return { next, range, int, pick, chance, normal, poisson, binomial }
}

export type Rng = ReturnType<typeof createRng>
