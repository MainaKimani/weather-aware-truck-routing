import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState, type ReactNode } from 'react'

import { createQueryClient } from '../api/queryClient'

// Dev-only, and loaded on demand, so it never reaches the production bundle.
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        // Bottom-left, clear of the timeline's hour readout.
        default: () => <m.ReactQueryDevtools buttonPosition="bottom-left" />,
      })),
    )
  : () => null

interface AppProvidersProps {
  children: ReactNode
  /** Tests pass their own client so each starts with an empty cache. */
  queryClient?: QueryClient
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <QueryClientProvider client={client}>
      {children}
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    </QueryClientProvider>
  )
}
