import { getClub, getNation } from '../data'
import type { FlagSpec, Player } from '../data/types'

// Small visual identity pieces: flags, club badges and player placeholders.

function FlagShapes({ spec }: { spec: FlagSpec }) {
  const W = 30
  const H = 20
  switch (spec.kind) {
    case 'h':
    case 'v': {
      const weights = spec.weights ?? spec.colors.map(() => 1)
      const total = weights.reduce((a, b) => a + b, 0)
      let offset = 0
      return (
        <>
          {spec.colors.map((c, i) => {
            const size = (weights[i] / total) * (spec.kind === 'h' ? H : W)
            const rect =
              spec.kind === 'h' ? <rect key={i} x={0} y={offset} width={W} height={size + 0.5} fill={c} /> : <rect key={i} x={offset} y={0} width={size + 0.5} height={H} fill={c} />
            offset += size
            return rect
          })}
        </>
      )
    }
    case 'nordic':
      return (
        <>
          <rect width={W} height={H} fill={spec.bg} />
          <rect x={8} y={0} width={5} height={H} fill={spec.cross} />
          <rect x={0} y={7.5} width={W} height={5} fill={spec.cross} />
          {spec.inner && (
            <>
              <rect x={9.5} y={0} width={2} height={H} fill={spec.inner} />
              <rect x={0} y={9} width={W} height={2} fill={spec.inner} />
            </>
          )}
        </>
      )
    case 'stgeorge':
      return (
        <>
          <rect width={W} height={H} fill={spec.bg} />
          <rect x={12.5} y={0} width={5} height={H} fill={spec.cross} />
          <rect x={0} y={7.5} width={W} height={5} fill={spec.cross} />
        </>
      )
    case 'disc':
      return (
        <>
          <rect width={W} height={H} fill={spec.bg} />
          <circle cx={15} cy={10} r={6} fill={spec.disc} />
        </>
      )
    case 'diamond':
      return (
        <>
          <rect width={W} height={H} fill={spec.bg} />
          <polygon points="15,2.5 27,10 15,17.5 3,10" fill={spec.diamond} />
          <circle cx={15} cy={10} r={4.2} fill={spec.disc} />
        </>
      )
  }
}

export function Flag({ code, size = 16 }: { code: string; size?: number }) {
  const nation = getNation(code)
  if (!nation) return null
  return (
    <svg className="flag" width={size * 1.5} height={size} viewBox="0 0 30 20" role="img" aria-label={nation.name}>
      <title>{nation.name}</title>
      <FlagShapes spec={nation.flag} />
    </svg>
  )
}

export function ClubBadge({ clubId, size = 20 }: { clubId: string; size?: number }) {
  const club = getClub(clubId)
  if (!club) return null
  const [a, b] = club.colors
  const showText = size >= 34
  return (
    <svg className="club-badge" width={size} height={size * 1.15} viewBox="0 0 40 46" role="img" aria-label={club.name}>
      <title>{club.name}</title>
      <path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z" fill={a} stroke="rgba(0,0,0,.25)" strokeWidth="1.2" />
      <path d="M20 1 L38 6 V22 C38 34 30 41 20 45 Z" fill={b} opacity={0.9} />
      <path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.2" />
      {showText && (
        <text x="20" y="27" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,.55)" strokeWidth="2.4" paintOrder="stroke" fontFamily="Inter, sans-serif">
          {club.abbr}
        </text>
      )}
    </svg>
  )
}

export function PlayerAvatar({ player, size = 96 }: { player: Player; size?: number }) {
  const club = getClub(player.clubId)
  const accent = club?.colors[0] ?? '#888'
  return (
    <div className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <rect width="100" height="100" className="avatar-bg" />
        <circle cx="50" cy="38" r="17" className="avatar-fg" />
        <path d="M18 100 C18 72 32 62 50 62 C68 62 82 72 82 100 Z" className="avatar-fg" />
        <rect y="96" width="100" height="4" fill={accent} />
      </svg>
    </div>
  )
}
