import { QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { createQueryClient } from '../api/queryClient'

/**
 * A fresh query cache per test, so no test sees another's plan. Same retry
 * rules as the app, without the back-off wait.
 */
export function freshClient() {
  const client = createQueryClient()
  const { queries, mutations } = client.getDefaultOptions()
  client.setDefaultOptions({
    queries: { ...queries, retryDelay: 0 },
    mutations: { ...mutations, retryDelay: 0 },
  })
  return client
}

export function withClient(client = freshClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

export function renderWithClient(ui: ReactElement, options?: RenderOptions) {
  const client = freshClient()
  return { client, ...render(ui, { wrapper: withClient(client), ...options }) }
}

export function renderHookWithClient<T>(hook: () => T) {
  const client = freshClient()
  return { client, ...renderHook(hook, { wrapper: withClient(client) }) }
}
