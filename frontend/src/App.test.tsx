import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App shell', () => {
  it('lays out the header, planner panel, map and timeline as landmarks', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Trip planner' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo', { name: 'Forecast timeline' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plan a weather-aware trip' })).toBeInTheDocument()
  })

  it('gives icon-only controls an accessible name', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: /Weather-Aware Truck Routing/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })

  it('switches every surface by toggling the theme on <html>', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })
})
