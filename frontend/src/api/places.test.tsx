import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderHookWithClient } from '../test/render'
import { SUGGEST, server } from '../test/server'
import { normaliseQuery, usePlaceSuggestions } from './places'

function countRequests() {
  const queries: string[] = []
  server.use(
    http.get(SUGGEST, ({ request }) => {
      queries.push(new URL(request.url).searchParams.get('q') ?? '')
      return HttpResponse.json([{ label: 'Dallas, TX', lat: 32.7767, lon: -96.797, tz: null }])
    }),
  )
  return queries
}

describe('usePlaceSuggestions', () => {
  it('makes no request under two characters', () => {
    const queries = countRequests()
    const { result } = renderHookWithClient(() => usePlaceSuggestions(' d '))

    expect(result.current.fetchStatus).toBe('idle')
    expect(queries).toEqual([])
  })

  it('normalises the query like the backend', async () => {
    const queries = countRequests()
    const { result } = renderHookWithClient(() => usePlaceSuggestions('  DALLAS   tx '))

    await waitFor(() => {
      expect(result.current.data?.[0]?.label).toBe('Dallas, TX')
    })
    expect(queries).toEqual(['dallas tx'])
    expect(normaliseQuery(' São   PAULO ')).toBe('são paulo')
  })

  it('serves a repeated query from the cache', async () => {
    const queries = countRequests()
    const { result, rerender } = renderHookWithClient(() => usePlaceSuggestions('dal'))
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    rerender()

    expect(queries).toEqual(['dal'])
  })
})
