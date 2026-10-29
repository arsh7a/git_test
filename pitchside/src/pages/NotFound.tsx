import { Link } from 'react-router-dom'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="container page">
      <div className="panel">
        <div className="panel-body empty-state">
          <h1>We couldn’t find that {what}.</h1>
          <p className="muted">It may have been renamed, or the link is incomplete.</p>
          <p><Link className="btn" to="/">Back to the homepage</Link></p>
        </div>
      </div>
    </div>
  )
}
