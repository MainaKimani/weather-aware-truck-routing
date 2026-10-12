import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { planKeys } from '../../api/plans'
import type { Me, PatchedTripUpdateRequest, Plan, Trip } from '../../api/schema'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { savedTrip } from '../../test/fixtures/savedTrip'
import { renderApp } from '../../test/renderApp'
import { ME, TRIP, apiError, server, signedIn, visitor } from '../../test/server'

const ID = demoPlan.trip_id
const NEW_ID = '7e1d2c3b-4a59-4687-9a8b-1c2d3e4f5a6b'
const REPLAN = '*/api/v1/trips/:tripId/replan'

/** One trip the test can change through the API, and who is asking. */
function serveTrip(meta: Partial<Trip> = {}, me: Me = signedIn()) {
  let trip = savedTrip(demoPlan, meta)
  const patches: PatchedTripUpdateRequest[] = []
  const deletes: string[] = []
  const replans: (string | null)[] = []
  const detailRequests: string[] = []
  server.use(
    http.get(ME, () => HttpResponse.json(me)),
    http.get(TRIP, ({ params }) => {
      detailRequests.push(String(params.tripId))
      return params.tripId === ID
        ? HttpResponse.json(trip)
        : HttpResponse.json(savedTrip({ ...demoPlan, trip_id: String(params.tripId) }))
    }),
    http.patch(TRIP, async ({ request }) => {
      const body = (await request.json()) as PatchedTripUpdateRequest
      patches.push(body)
      trip = { ...trip, ...body }
      return HttpResponse.json(trip)
    }),
    http.delete(TRIP, ({ params }) => {
      deletes.push(String(params.tripId))
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(REPLAN, ({ request }) => {
      replans.push(request.headers.get('Idempotency-Key'))
      return HttpResponse.json(
        savedTrip({ ...demoPlan, trip_id: NEW_ID }, { replanned_from: ID, is_owner: true }),
      )
    }),
  )
  return { patches, deletes, replans, detailRequests }
}

async function openTrip() {
  renderApp(`/trips/${ID}`)
  return screen.findByRole('region', { name: 'Trip actions' })
}

describe('trip actions', () => {
  it('saves a trip under a name', async () => {
    const api = serveTrip()
    const actions = await openTrip()

    await userEvent.click(within(actions).getByRole('button', { name: '☆ Save' }))
    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(name).toHaveValue('Dallas, TX → Denver, CO')
    expect(name).toHaveFocus()
    await userEvent.clear(name)
    await userEvent.keyboard('Weekly run{Enter}')

    expect(await screen.findByText('Trip saved. It stays until you delete it.')).toBeInTheDocument()
    expect(api.patches).toEqual([{ name: 'Weekly run', saved: true }])
    expect(within(actions).getByRole('button', { name: '★ Saved' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Weekly run')).toBeInTheDocument() // the banner's name
  })

  it('unsaves with the same button', async () => {
    const api = serveTrip({ saved: true, name: 'Weekly run' })
    const actions = await openTrip()

    await userEvent.click(within(actions).getByRole('button', { name: '★ Saved' }))

    await waitFor(() => {
      expect(api.patches).toEqual([{ saved: false }])
    })
    expect(await within(actions).findByRole('button', { name: '☆ Save' })).toBeInTheDocument()
  })

  it('asks a guest to make an account to save, and saves nothing', async () => {
    const api = serveTrip({}, { user: null, guest: true, recent_trip_count: 1 })
    const actions = await openTrip()
    const save = within(actions).getByRole('button', { name: '☆ Save' })

    await userEvent.click(save)

    const dialog = screen.getByRole('dialog', { name: 'Create an account to save trips' })
    expect(dialog).toHaveAccessibleDescription(/come with you/)
    expect(within(dialog).getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      `/signup?next=${encodeURIComponent(`/trips/${ID}`)}`,
    )
    expect(within(dialog).getByRole('button', { name: 'Not now' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(save).toHaveFocus()
    expect(api.patches).toEqual([])
  })

  it('shares with a switch, and copies the link', async () => {
    const user = userEvent.setup()
    const api = serveTrip()
    const actions = await openTrip()
    const share = within(actions).getByRole('switch', { name: 'Share' })
    expect(share).toHaveAttribute('aria-checked', 'false')

    await user.click(share)
    await waitFor(() => {
      expect(share).toHaveAttribute('aria-checked', 'true')
    })
    await user.click(within(actions).getByRole('button', { name: 'Copy link' }))

    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/trips/${ID}`)
    await user.click(share)
    await waitFor(() => {
      expect(share).toHaveAttribute('aria-checked', 'false')
    })
    expect(api.patches).toEqual([{ shared: true }, { shared: false }])
    expect(within(actions).queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
    expect(screen.getByText(/the link no longer opens this trip/)).toBeInTheDocument()
  })

  it.each([
    ['a user', signedIn(), 'My trips'],
    ['a guest', { user: null, guest: true, recent_trip_count: 1 }, 'Plan a weather-aware trip'],
  ])('deletes after asking, then takes %s to %s', async (_, me, heading) => {
    const api = serveTrip({}, me)
    const actions = await openTrip()

    await userEvent.click(within(actions).getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete trip' }))

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(api.deletes).toEqual([ID])
  })

  it("offers only Re-plan on someone else's shared trip, and no editing", async () => {
    serveTrip({ shared: true, is_owner: false }, visitor)
    const actions = await openTrip()

    expect(
      within(actions)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Re-plan with current weather'])
    expect(within(actions).getByText(/Shared with you, read-only/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit trip' })).not.toBeInTheDocument()
  })

  it('re-plans into a new trip and opens it', async () => {
    const api = serveTrip()
    const { client } = renderApp(`/trips/${ID}`)
    const actions = await screen.findByRole('region', { name: 'Trip actions' })

    await userEvent.click(
      within(actions).getByRole('button', { name: 'Re-plan with current weather' }),
    )

    await waitFor(() => {
      expect(api.replans).toHaveLength(1)
    })
    expect(api.replans[0]).toMatch(/^[0-9a-f-]{36}$/)
    // The new trip's page shows it, from the response, with no second request for it.
    await waitFor(() => {
      expect(client.getQueryData<Plan>(planKeys.current())?.trip_id).toBe(NEW_ID)
    })
    expect(api.detailRequests).not.toContain(NEW_ID)
  })

  it('says so when re-planning fails', async () => {
    serveTrip()
    server.use(http.post(REPLAN, () => apiError(422, 'no_route', 'No truck route.')))
    const actions = await openTrip()

    await userEvent.click(
      within(actions).getByRole('button', { name: 'Re-plan with current weather' }),
    )

    expect(await within(actions).findByRole('alert')).toHaveTextContent("Couldn't re-plan")
  })
})
