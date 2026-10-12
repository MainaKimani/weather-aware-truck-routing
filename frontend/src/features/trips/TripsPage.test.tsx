import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { at } from '../../test/at'
import { renderApp } from '../../test/renderApp'
import { TRIPS, apiError, server } from '../../test/server'
import { makeTrips, serveTripStore } from '../../test/tripStore'
import { SEARCH_DEBOUNCE_MS } from './TripsPage'

const list = () => screen.findByRole('list', { name: 'Trips' })
const rows = () => within(screen.getByRole('list', { name: 'Trips' })).getAllByRole('listitem')

describe('My trips', () => {
  it('with none yet, points to the planner', async () => {
    serveTripStore([])
    renderApp('/trips')

    expect(await screen.findByText('No trips yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan your first trip' })).toHaveAttribute('href', '/')
  })

  it('shows a trip with its name, route, load, pick and when it was planned', async () => {
    serveTripStore(makeTrips(1))
    renderApp('/trips')

    await list()
    const row = at(rows(), 0)
    expect(row).toHaveTextContent('Trip 1')
    expect(row).toHaveTextContent('42,000 lb')
    expect(row).toHaveTextContent('Route A, worst')
    expect(row).toHaveTextContent(/Planned \w{3} \d+ Oct/)
    expect(within(row).getByRole('link', { name: /Trip 1/ })).toHaveAttribute(
      'href',
      '/trips/00000000-0000-4000-8000-000000000001',
    )
  })

  // 200 rows of buttons is slow to render in jsdom, the more so with other files running.
  it('pages through 200 trips, each once, as more are asked for', { timeout: 20_000 }, async () => {
    serveTripStore(makeTrips(200))
    renderApp('/trips')
    await list()
    expect(rows()).toHaveLength(20)

    for (let shown = 40; shown <= 200; shown += 20) {
      fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
      await waitFor(() => {
        expect(rows()).toHaveLength(shown)
      })
    }

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    const names = rows().map((r) => within(r).getByRole('link').textContent)
    expect(new Set(names).size).toBe(200)
  })

  it('shows saved trips alone, and finds trips by text after a pause in typing', async () => {
    const trips = makeTrips(3)
    trips[1] = { ...at(trips, 1), saved: true, name: 'Denver weekly' }
    const store = serveTripStore(trips)
    renderApp('/trips')
    await list()

    await userEvent.click(screen.getByRole('button', { name: 'Saved' }))
    await waitFor(() => {
      expect(rows()).toHaveLength(1)
    })
    expect(store.lists.at(-1)?.get('saved')).toBe('true')

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search trips' }), 'weekly')
    await waitFor(() => {
      expect(rows()).toHaveLength(1)
    })
    expect(rows()[0]).toHaveTextContent('Denver weekly')
    const searches = store.lists.filter((p) => p.get('q'))
    expect(searches.map((p) => p.get('q'))).toEqual(['weekly'])

    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search trips' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search trips' }), 'nowhere')
    expect(await screen.findByText('No trips match.')).toBeInTheDocument()
    expect(SEARCH_DEBOUNCE_MS).toBe(300)
  })

  it('saves and unsaves with the star', async () => {
    const store = serveTripStore(makeTrips(1))
    renderApp('/trips')
    await list()
    const star = screen.getByRole('button', { name: 'Save Trip 1' })

    await userEvent.click(star)

    await waitFor(() => {
      expect(star).toHaveAttribute('aria-pressed', 'true')
    })
    expect(store.patches).toEqual([
      { id: '00000000-0000-4000-8000-000000000001', body: { saved: true } },
    ])
  })

  it('renames a trip in place with the keyboard', async () => {
    const store = serveTripStore(makeTrips(1))
    renderApp('/trips')
    await list()

    await userEvent.click(screen.getByRole('button', { name: 'Rename: Trip 1' }))
    const input = screen.getByRole('textbox', { name: 'Name for Trip 1' })
    expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.keyboard('Weekly run{Enter}')

    expect(await screen.findByRole('link', { name: /Weekly run/ })).toBeInTheDocument()
    expect(store.patches.at(-1)?.body).toEqual({ name: 'Weekly run' })
  })

  it('shares a trip and copies its link', async () => {
    const user = userEvent.setup()
    const store = serveTripStore(makeTrips(1))
    renderApp('/trips')
    await list()

    await user.click(screen.getByRole('button', { name: 'Share: Trip 1' }))
    expect(await screen.findByText(/Sharing is on/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy link: Trip 1' }))

    expect(await screen.findByText('Link copied.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/trips/00000000-0000-4000-8000-000000000001`,
    )
    expect(store.patches.at(-1)?.body).toEqual({ shared: true })
    expect(rows()[0]).toHaveTextContent('Shared')
  })

  it('asks before deleting, and Escape keeps the trip', async () => {
    const store = serveTripStore(makeTrips(2))
    renderApp('/trips')
    await list()

    await userEvent.click(screen.getByRole('button', { name: 'Delete: Trip 1' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this trip?' })
    expect(dialog).toHaveAccessibleDescription('Trip 1 will be gone for good.')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete: Trip 1' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Delete: Trip 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete trip' }))

    expect(await screen.findByText('Trip deleted.')).toBeInTheDocument()
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Trip 2')
    expect(store.deletes).toEqual(['00000000-0000-4000-8000-000000000001'])
  })

  it('keeps focus inside the delete dialog', async () => {
    serveTripStore(makeTrips(1))
    renderApp('/trips')
    await list()
    await userEvent.click(screen.getByRole('button', { name: 'Delete: Trip 1' }))

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Delete trip' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('says so when the list fails, and retries', async () => {
    serveTripStore(makeTrips(1))
    let failures = 2
    server.use(
      http.get(TRIPS, () => {
        if (failures-- > 0) return apiError(503, 'server_error', 'Down.')
        return undefined
      }),
    )
    renderApp('/trips')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load your trips.")
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await list()).toBeInTheDocument()
  })

  it('is for signed-in users: anyone else is asked to log in first', async () => {
    renderApp('/trips')

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})
