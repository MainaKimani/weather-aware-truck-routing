import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Me, TripSummary } from '../../api/schema'
import { summaryFromPlan } from '../../api/trips'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { renderApp } from '../../test/renderApp'
import { ME, PLANS, TRIPS, server, signedIn, visitor } from '../../test/server'

const guest = (trips: number): Me => ({ user: null, guest: true, recent_trip_count: trips })
const older: TripSummary = { ...summaryFromPlan(strongHosPlan), name: 'Storm day' }

function serve(me: Me, trips: TripSummary[] = []) {
  server.use(
    http.get(ME, () => HttpResponse.json(me)),
    http.get(TRIPS, () => HttpResponse.json({ next: null, previous: null, results: trips })),
  )
}

const menuButton = () => screen.findByRole('button', { name: /^Recent trips/ })
const panel = () => screen.getByRole('region', { name: 'Recent trips' })

describe('recent trips menu', () => {
  it('is not there for a visitor who has not planned, or for a signed-in user', async () => {
    serve(visitor)
    const { unmount } = renderApp('/no/page')
    await screen.findByRole('heading', { name: 'Page not found' })
    expect(screen.queryByRole('button', { name: /^Recent trips/ })).not.toBeInTheDocument()
    unmount()

    serve(signedIn('driver@example.com', 4))
    renderApp('/no/page')
    await screen.findByText('driver@example.com')
    expect(screen.queryByRole('button', { name: /^Recent trips/ })).not.toBeInTheDocument()
  })

  it("lists a guest's trips, each linking to its page, and asks them to sign up", async () => {
    serve(guest(1), [older])
    renderApp('/no/page')

    const button = await menuButton()
    expect(button).toHaveTextContent('Recent trips1')
    await userEvent.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const link = await within(panel()).findByRole('link', { name: /Storm day/ })
    expect(link).toHaveAttribute('href', `/trips/${strongHosPlan.trip_id}`)
    expect(link).toHaveTextContent('42,000 lb')
    expect(within(panel()).getByRole('link', { name: 'Sign up to keep these' })).toHaveAttribute(
      'href',
      '/signup',
    )

    await userEvent.click(link)
    expect(await screen.findByText(/with the forecast as of then/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Recent trips' })).not.toBeInTheDocument()
  })

  it('puts a new trip at the top as soon as it is planned', async () => {
    let refetches = 0
    server.use(
      http.get(ME, () => HttpResponse.json(guest(1))),
      http.get(TRIPS, async () => {
        refetches += 1
        if (refetches > 1) await delay('infinite') // the list catching up never arrives
        return HttpResponse.json({ next: null, previous: null, results: [older] })
      }),
      http.post(PLANS, () => HttpResponse.json(demoPlan)),
    )
    renderApp('/')
    await userEvent.click(await menuButton())
    await within(panel()).findByRole('link', { name: /Storm day/ })
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: 'Use the demo trip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Plan trip' }))
    await screen.findByText(/with the forecast as of then/)
    await userEvent.click(await menuButton())

    const links = within(panel()).getAllByRole('link', { name: /→|Storm day/ })
    expect(links[0]).toHaveAttribute('href', `/trips/${demoPlan.trip_id}`)
    expect(links[0]).toHaveTextContent('Dallas, TX → Denver, CO')
    expect(links[1]).toHaveTextContent('Storm day')
    expect(refetches).toBeGreaterThan(1)
  })

  it('closes on Escape, giving focus back, and on a press outside it', async () => {
    serve(guest(1), [older])
    renderApp('/no/page')
    const button = await menuButton()

    await userEvent.click(button)
    await userEvent.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()

    await userEvent.click(button)
    await userEvent.click(screen.getByRole('heading', { name: 'Page not found' }))
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })
})
