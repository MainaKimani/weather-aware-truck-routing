import type { ReactNode } from 'react'

/** The layout for pages other than the planner: one readable column that scrolls. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  )
}
