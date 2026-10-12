import type { ReactNode } from 'react'

import { Header } from './Header'

interface AppShellProps {
  badges?: ReactNode
  /** The page: the planner, or one of the account and trip-list pages. */
  children: ReactNode
}

/** Every page: the header above, the page filling the rest of the window. */
export function AppShell({ badges, children }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col">
      <Header badges={badges} />
      {children}
    </div>
  )
}
