import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClubBadge, Flag, PlayerAvatar } from '../components/Identity'
import { SearchBox } from '../components/SearchBox'
import { Segmented } from '../components/UI'
import { dataset, getSeasonRows } from '../data'
import { GROUP_LABEL } from '../data/metrics'
import type { PositionGroup } from '../data/types'

const GROUPS: PositionGroup[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST']
const PAGE = 36
type SortKey = 'mins' | 'name' | 'age' | 'ga'

export function Players() {
  const [group, setGroup] = useState<PositionGroup | 'all'>('all')
  const [league, setLeague] = useState('all')
  const [sort, setSort] = useState<SortKey>('mins')
  const [page, setPage] = useState(0)
  const season = dataset.currentSeason

  const rows = useMemo(() => {
    const list = getSeasonRows(season).filter((r) => (group === 'all' || r.player.group === group) && (league === 'all' || r.league.id === league))
    const by: Record<SortKey, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      mins: (a, b) => b.stats.mins - a.stats.mins,
      name: (a, b) => a.player.lastName.localeCompare(b.player.lastName),
      age: (a, b) => a.age - b.age,
      ga: (a, b) => b.stats.goals + b.stats.assists - (a.stats.goals + a.stats.assists),
    }
    return list.sort(by[sort])
  }, [group, league, sort, season])

  const pages = Math.ceil(rows.length / PAGE)
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Players</h1>
          <p className="muted">Browse all players with league minutes in {season}. Click any player for their full profile.</p>
        </div>
        <SearchBox variant="picker" placeholder="Jump to a player…" />
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Position">
          <button type="button" className={group === 'all' ? 'chip on' : 'chip'} onClick={() => { setGroup('all'); setPage(0) }}>All positions</button>
          {GROUPS.map((g) => (
            <button key={g} type="button" className={group === g ? 'chip on' : 'chip'} title={GROUP_LABEL[g]} onClick={() => { setGroup(g); setPage(0) }}>
              {g}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="select-wrap">
            <span className="select-label">League</span>
            <select value={league} onChange={(e) => { setLeague(e.target.value); setPage(0) }}>
              <option value="all">All leagues</option>
              {dataset.leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <Segmented label="Sort" value={sort} onChange={(v) => { setSort(v); setPage(0) }} options={[{ value: 'mins', label: 'Minutes' }, { value: 'ga', label: 'G+A' }, { value: 'age', label: 'Youngest' }, { value: 'name', label: 'A–Z' }]} />
        </div>
      </div>

      <div className="muted small result-count">{rows.length.toLocaleString('en-GB')} players</div>
      <div className="player-grid">
        {visible.map((r) => (
          <Link key={r.player.id} to={`/players/${r.player.id}`} className="pcard">
            <PlayerAvatar player={r.player} size={40} />
            <div className="pcard-id">
              <div className="pcard-name">{r.player.name}</div>
              <div className="pcard-meta">
                <span className="pos-badge">{r.player.primaryPosition}</span>
                <ClubBadge clubId={r.club.id} size={13} /> <span className="ellipsis">{r.club.shortName}</span>
              </div>
            </div>
            <div className="pcard-stats">
              <span><Flag code={r.player.nationCode} size={10} /> {r.age}</span>
              <span className="num">{r.stats.mins.toLocaleString('en-GB')}′</span>
              {r.player.group === 'GK' ? <span className="num">{r.stats.cleanSheets} CS</span> : <span className="num">{r.stats.goals}G {r.stats.assists}A</span>}
            </div>
          </Link>
        ))}
      </div>
      {pages > 1 && (
        <div className="pager">
          <span className="muted">Page {page + 1} of {pages}</span>
          <div className="pager-btns">
            <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
