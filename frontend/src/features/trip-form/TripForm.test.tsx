import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { PlanRequest } from '../../api/schema'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { renderWithClient } from '../../test/render'
import { PLANS, SUGGEST, apiError, server } from '../../test/server'
import { TripForm } from './TripForm'

const NOW = new Date('2026-10-12T10:20:00Z')
const now = () => NOW

function capturePlans() {
  const bodies: PlanRequest[] = []
  server.use(
    http.post(PLANS, async ({ request }) => {
      bodies.push((await request.json()) as PlanRequest)
      return HttpResponse.json(demoPlan)
    }),
  )
  return bodies
}

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  const input = screen.getByRole('combobox', { name: label })
  await user.clear(input)
  await user.type(input, text)
  await screen.findByRole('option')
  await user.keyboard('{ArrowDown}{Enter}')
}

function renderForm() {
  const user = userEvent.setup()
  renderWithClient(<TripForm now={now} />)
  return user
}

describe('TripForm', () => {
  it('plans a trip using only the keyboard', async () => {
    const bodies = capturePlans()
    const user = renderForm()

    await pick(user, 'Origin', 'dal')
    expect(screen.getByRole('combobox', { name: 'Origin' })).toHaveValue('Dallas, TX')
    expect(screen.getByText('America/Chicago')).toBeInTheDocument()
    await pick(user, 'Destination', 'den')

    const departure = screen.getByLabelText('Departure')
    await user.clear(departure)
    await user.type(departure, '2026-10-12T06:00')
    await user.click(screen.getByLabelText(/Load weight/))
    await user.keyboard('42000')
    await user.tab()
    expect(screen.getByLabelText(/Load weight/)).toHaveValue('42,000')
    await user.click(screen.getByRole('radio', { name: '50 mi' }))
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    await waitFor(() => {
      expect(bodies).toHaveLength(1)
    })
    expect(bodies[0]).toEqual({
      origin: { label: 'Dallas, TX', lat: 32.7767, lon: -96.797, tz: 'America/Chicago' },
      destination: { label: 'Denver, CO', lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
      departure: '2026-10-12T11:00:00.000Z', // 06:00 in Dallas (CDT)
      load_lb: 42_000,
      interval_mi: 50,
      hos: { enabled: false },
    })
  })

  it('shows every missing field with the API message, without sending', async () => {
    const bodies = capturePlans()
    const user = renderForm()

    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(await screen.findAllByText('This field is required.')).toHaveLength(3)
    expect(screen.getByRole('combobox', { name: 'Origin' })).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toEqual([])
  })

  it('asks for a suggestion when text was typed but none picked', async () => {
    const user = renderForm()

    await user.type(screen.getByRole('combobox', { name: 'Origin' }), 'Dallsa')
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(await screen.findByText('Choose a place from the suggestions.')).toBeInTheDocument()
  })

  it('typing after picking clears the picked place', async () => {
    const user = renderForm()
    await pick(user, 'Origin', 'dal')

    await user.type(screen.getByRole('combobox', { name: 'Origin' }), 'x')

    expect(screen.queryByText('America/Chicago')).toBeNull()
  })

  it('says when nothing matches, and when search is down', async () => {
    const user = renderForm()
    const origin = screen.getByRole('combobox', { name: 'Origin' })

    await user.type(origin, 'zzz')
    expect(await screen.findByText('No matches')).toBeInTheDocument()

    server.use(http.get(SUGGEST, () => apiError(502, 'geocoding_unavailable', 'Down.')))
    await user.clear(origin)
    await user.type(origin, 'qq')
    expect(
      await screen.findByText('Place search is unavailable. Try again shortly.'),
    ).toBeInTheDocument()
  })

  it('swaps origin and destination', async () => {
    const user = renderForm()
    await pick(user, 'Origin', 'dal')
    await pick(user, 'Destination', 'den')

    await user.click(screen.getByRole('button', { name: 'Swap origin and destination' }))

    expect(screen.getByRole('combobox', { name: 'Origin' })).toHaveValue('Denver, CO')
    expect(screen.getByRole('combobox', { name: 'Destination' })).toHaveValue('Dallas, TX')
    expect(screen.getByText('America/Denver')).toBeInTheDocument()
  })

  it('notes lower confidence for departures over 48 h ahead', async () => {
    const user = renderForm()
    const departure = screen.getByLabelText('Departure')

    await user.clear(departure)
    await user.type(departure, '2026-10-15T06:00')

    expect(screen.getByText(/forecasts this far out are less reliable/)).toBeInTheDocument()
  })

  it('puts errors the server finds next to their fields', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(400, 'invalid_input', 'Some fields are invalid.', {
          fields: {
            departure: ["Departure can't be in the past."],
            'origin.tz': ['Not a known IANA time zone.'],
          },
        }),
      ),
    )
    const user = renderForm()
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))

    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(await screen.findByText("Departure can't be in the past.")).toBeInTheDocument()
    expect(screen.getByText('Not a known IANA time zone.')).toBeInTheDocument()
  })

  it('collapses to a summary after planning, and reopens to edit', async () => {
    capturePlans()
    const user = renderForm()
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))

    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(await screen.findByText('Dallas, TX → Denver, CO')).toBeInTheDocument()
    expect(screen.getByText(/42,000 lb · every 25 mi/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit trip' }))
    expect(screen.getByRole('combobox', { name: 'Origin' })).toHaveValue('Dallas, TX')
  })

  it('shows non-field failures with a retry', async () => {
    server.use(http.post(PLANS, () => apiError(422, 'no_route', 'No truck route was found.')))
    const user = renderForm()
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))

    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No truck route was found.')
  })
})
