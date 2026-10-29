import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { dataset } from '../data'
import { sourceLogo } from '../data/source'
import { SearchBox } from './SearchBox'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('pitchside-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function Layout() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const location = useLocation()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('pitchside-theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  // Start each new page at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const isHome = location.pathname === '/'

  return (
    <div className="app">
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="Pitchside home">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="1.5" y="3.5" width="21" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="15.5" y="12.5" width="2.2" height="5" rx=".6" fill="var(--accent-nav)" />
              <rect x="18.6" y="9.5" width="2.2" height="8" rx=".6" fill="var(--accent-nav)" />
            </svg>
            <span>Pitchside</span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/players">Players</NavLink>
            <NavLink to="/leagues">Leagues</NavLink>
            <NavLink to="/compare">Comparisons</NavLink>
            <NavLink to="/stats">Statistics</NavLink>
          </nav>
          <div className="nav-right">
            {!isHome && <SearchBox variant="nav" />}
            <button
              type="button"
              className="theme-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="4" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="10" y1="1.8" x2="10" y2="3.6" transform={`rotate(${a} 10 10)`} />)}</g></svg>
              ) : (
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M15.5 12.8A6.5 6.5 0 0 1 7.2 4.5a6.5 6.5 0 1 0 8.3 8.3Z" fill="currentColor" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>
      {dataset.isSample && (
        <div className="sample-banner" role="note">
          <div className="container">
            <strong>Sample data.</strong> Every player, club, league and statistic shown is fictional and generated for demonstration. No real-world data is displayed.
          </div>
        </div>
      )}
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>Pitchside · prototype</span>
          <span className="muted footer-source">
            Data: <SourceCredits />
          </span>
        </div>
      </footer>
    </div>
  )
}

/** Each data source with the seasons it supplies; StatsBomb's terms require its logo. */
function SourceCredits() {
  const bySource = new Map<string, string[]>()
  for (const [season, source] of Object.entries(dataset.seasonSources ?? {})) bySource.set(source, [...(bySource.get(source) ?? []), season].sort())
  if (!bySource.size) return <>{sourceLogo ? <img src={sourceLogo} alt={dataset.sourceName} className="source-logo" /> : dataset.sourceName}</>
  return (
    <>
      {[...bySource].map(([source, seasons], i) => (
        <span key={source} className="footer-source">
          {i > 0 && ' · '}
          {source.startsWith('StatsBomb') && sourceLogo ? <img src={sourceLogo} alt={source} className="source-logo" /> : source}{' '}
          ({seasons.length > 1 ? `${seasons[0]} to ${seasons[seasons.length - 1]}` : seasons[0]})
        </span>
      ))}
    </>
  )
}
