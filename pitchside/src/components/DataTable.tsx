import { useEffect, useMemo, useState, type ReactNode } from 'react'

// A compact, sortable table used throughout the site.

export interface Column<T> {
  key: string
  label: ReactNode
  title?: string // tooltip explaining the column
  align?: 'left' | 'right' | 'center'
  render: (row: T, index: number) => ReactNode
  /** Value used for sorting. Omit to make the column unsortable. */
  sortValue?: (row: T) => number | string | null
  className?: string
  sticky?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  onRowClick?: (row: T) => void
  footer?: ReactNode
  pageSize?: number
  highlightKey?: string
  empty?: ReactNode
  /** Controlled sort (optional). */
  sort?: { key: string; dir: 'asc' | 'desc' }
  onSortChange?: (s: { key: string; dir: 'asc' | 'desc' }) => void
  dense?: boolean
}

export function DataTable<T>({ columns, rows, rowKey, initialSort, onRowClick, footer, pageSize, highlightKey, empty, sort: controlled, onSortChange, dense }: Props<T>) {
  const [internal, setInternal] = useState(initialSort)
  const sort = controlled ?? internal
  const [page, setPage] = useState(0)
  // Go back to the first page whenever the filtered rows change.
  useEffect(() => setPage(0), [rows])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1 // blanks always last
      if (vb == null) return -1
      if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * dir
      return (va - vb) * dir
    })
  }, [rows, sort, columns])

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const safePage = Math.min(page, pages - 1)
  const visible = pageSize ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted

  const toggle = (c: Column<T>) => {
    if (!c.sortValue) return
    const next: { key: string; dir: 'asc' | 'desc' } =
      sort?.key === c.key ? { key: c.key, dir: sort.dir === 'desc' ? 'asc' : 'desc' } : { key: c.key, dir: c.align === 'left' ? 'asc' : 'desc' }
    setPage(0)
    if (onSortChange) onSortChange(next)
    else setInternal(next)
  }

  return (
    <div className="tbl-outer">
      <div className="tbl-scroll">
        <table className={`tbl${dense ? ' tbl-dense' : ''}`}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    className={[c.align ? `al-${c.align}` : '', c.sortValue ? 'sortable' : '', active ? 'sorted' : '', c.sticky ? 'sticky-col' : '', c.className ?? ''].join(' ')}
                    title={c.title}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggle(c)}>
                        {c.label}
                        <span className="sort-ind" aria-hidden="true">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="tbl-empty">{empty ?? 'No rows match these filters.'}</td>
              </tr>
            )}
            {visible.map((row, i) => {
              const key = rowKey(row)
              return (
                <tr
                  key={key}
                  className={[onRowClick ? 'clickable' : '', highlightKey === key ? 'highlight' : ''].join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={[c.align ? `al-${c.align}` : '', sort?.key === c.key ? 'sorted' : '', c.sticky ? 'sticky-col' : '', c.className ?? ''].join(' ')}>
                      {c.render(row, (pageSize ? safePage * pageSize : 0) + i)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {pageSize && sorted.length > pageSize && (
        <div className="pager">
          <span className="muted">
            {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length.toLocaleString('en-GB')}
          </span>
          <div className="pager-btns">
            <button type="button" className="btn btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
            <span className="muted">Page {safePage + 1} of {pages}</span>
            <button type="button" className="btn btn-sm" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
