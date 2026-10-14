import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { planKeys } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { savedTrip } from '../../test/fixtures/savedTrip'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { renderApp } from '../../test/renderApp'
import { PLANS, TRIP, apiError, server } from '../../test/server'

function serveTrip(plan: Plan, meta: Parameters<typeof savedTrip>[1] = {}) {
  const requests: string[] = []
  server.use(
    http.get(TRIP, ({ params }) => {
      const tripId = String(params.tripId)
      requests.push(tripId)
      return HttpResponse.json(savedTrip({ ...plan, trip_id: tripId }, meta))
    }),
  )
  return requests
}

const banner = () => screen.findByText(/with the forecast as of then/)

describe('trip page', () => {
  it('shows a saved trip exactly as it was planned', async () => {
    const requests = serveTrip(strongHosPlan, { created_at: '2026-10-12T14:05:00Z' })

    const { client } = renderApp(`/trips/${strongHosPlan.trip_id}`)

    expect(await banner()).toHaveTextContent(
      'Planned Mon 12 Oct, 09:05 CDT, with the forecast as of then.',
    )
    const routes = screen.getByRole('list', { name: 'Ranked routes' })
    expect(within(routes).getByRole('button', { name: /^Route B/ })).toHaveTextContent(
      'Not drivable',
    )
    expect(client.getQueryData(planKeys.current())).toMatchObject(strongHosPlan)
    expect(screen.getByText(/Dallas, TX → Denver, CO/)).toBeInTheDocument()
    expect(requests).toEqual([strongHosPlan.trip_id])
  })

  it('offers a new trip, which opens the empty form and clears this one', async () => {
    serveTrip(demoPlan)
    const { client } = renderApp(`/trips/${demoPlan.trip_id}`)
    await banner()

    await userEvent.click(screen.getByRole('link', { name: 'Plan a New Trip' }))

    expect(await screen.findByRole('combobox', { name: 'Origin' })).toHaveValue('')
    expect(screen.queryByRole('list', { name: 'Ranked routes' })).toBeNull()
    await waitFor(() => {
      expect(client.getQueryData(planKeys.current())).toBeUndefined()
    })
  })

  it('shows the name the owner gave it', async () => {
    serveTrip(demoPlan, { name: 'Weekly run' })

    renderApp(`/trips/${demoPlan.trip_id}`)

    expect(await banner()).toHaveTextContent('Weekly run')
  })

  it("says the trip isn't there when it is missing or private", async () => {
    server.use(http.get(TRIP, () => apiError(404, 'not_found', 'Not found.')))

    renderApp('/trips/0d6c3a52-0000-4000-8000-000000000000')

    expect(await screen.findByRole('heading', { name: 'Trip not found' })).toBeInTheDocument()
    expect(screen.getByText(/deleted, or it's private/)).toBeInTheDocument()
  })

  it('offers a retry when the trip could not be loaded', async () => {
    let calls = 0
    server.use(
      http.get(TRIP, () => {
        calls += 1
        return calls <= 2
          ? apiError(503, 'server_error', 'Down.')
          : HttpResponse.json(savedTrip(demoPlan))
      }),
    )
    renderApp(`/trips/${demoPlan.trip_id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await banner()).toBeInTheDocument()
  })

  it("planning from a trip's page opens the new trip", async () => {
    serveTrip(demoPlan)
    const replanned = { ...demoPlan, trip_id: '7e1d2c3b-4a59-4687-9a8b-1c2d3e4f5a6b' }
    server.use(http.post(PLANS, () => HttpResponse.json(replanned)))
    const { client } = renderApp(`/trips/${demoPlan.trip_id}`)
    await banner()

    await userEvent.click(screen.getByRole('button', { name: 'Edit trip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Plan trip' }))

    await waitFor(() => {
      expect(client.getQueryState(['trips', replanned.trip_id, 'detail'])?.status).toBe('success')
    })
    expect(client.getQueryData<Plan>(planKeys.current())?.trip_id).toBe(replanned.trip_id)
  })

  it('editing an older trip starts from the next hour, not its past departure', async () => {
    serveTrip(demoPlan) // departed 09:00 UTC on 12 October, now passed
    renderApp(`/trips/${demoPlan.trip_id}`)
    await banner()

    await userEvent.click(screen.getByRole('button', { name: 'Edit trip' }))

    const departure = screen.getByLabelText(/^Departure/)
    expect((departure as HTMLInputElement).value > '2026-10-12T04:00').toBe(true)
    expect(screen.queryByText("Departure can't be in the past.")).not.toBeInTheDocument()
  })
})
