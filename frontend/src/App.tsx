import type { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router'

import { AppProviders } from './app/AppProviders'
import { routes } from './app/routes'

interface AppProps {
  /** Tests pass their own client so each starts with an empty cache. */
  queryClient?: QueryClient
  /** Tests start at a path in memory rather than the browser's address bar. */
  initialPath?: string
}

export default function App({ queryClient, initialPath }: AppProps) {
  const [router] = useState(() =>
    initialPath
      ? createMemoryRouter(routes, { initialEntries: [initialPath] })
      : createBrowserRouter(routes),
  )
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
