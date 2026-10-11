import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows the API as ok when healthz responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"ok"}')))

    render(<App />)

    expect(await screen.findByText('ok')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/v1/healthz', expect.anything())
  })

  it('shows the API as down when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))

    render(<App />)

    expect(await screen.findByText('down')).toBeInTheDocument()
  })
})
