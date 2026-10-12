import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useMe } from '../../api/me'

/**
 * Pages only a signed-in user has (My trips, Account): anyone else is sent
 * to log in, and comes back here afterwards.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const me = useMe()
  const location = useLocation()
  if (me.isPending) return <p className="text-sm text-muted">Loading…</p>
  if (me.isError) {
    return (
      <p role="alert" className="text-sm">
        Couldn't check whether you're signed in. Reload the page to try again.
      </p>
    )
  }
  if (!me.data.user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return children
}
