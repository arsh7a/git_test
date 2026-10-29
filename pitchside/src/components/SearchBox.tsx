import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClub, searchPlayers } from '../data'
import { GROUP_SHORT } from '../data/metrics'
import type { Player } from '../data/types'
import { ClubBadge, Flag } from './Identity'

interface Props {
  variant?: 'nav' | 'hero' | 'picker'
  placeholder?: string
  /** When provided, picking a player calls this instead of opening their profile. */
  onSelect?: (p: Player) => void
  autoFocus?: boolean
  excludeId?: string
}

export function SearchBox({ variant = 'nav', placeholder = 'Search players or clubs…', onSelect, autoFocus, excludeId }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const results = searchPlayers(q, 8).filter((p) => p.id !== excludeId)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const choose = (p: Player) => {
    setOpen(false)
    setQ('')
    if (onSelect) onSelect(p)
    else navigate(`/players/${p.id}`)
  }

  return (
    <div className={`search search-${variant}`} ref={wrapRef}>
      <svg className="search-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <line x1="12.6" y1="12.6" x2="17" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            choose(results[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && q.trim() && (
        <ul className="search-results" id={listId} role="listbox">
          {results.length === 0 && <li className="search-empty">No players found for “{q}”</li>}
          {results.map((p, i) => {
            const club = getClub(p.clubId)
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(p)
                }}
              >
                <ClubBadge clubId={p.clubId} size={18} />
                <span className="sr-name">{p.name}</span>
                <span className="sr-meta">
                  <Flag code={p.nationCode} size={10} /> {GROUP_SHORT[p.group]} · {club?.shortName}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
