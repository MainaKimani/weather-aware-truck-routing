import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { planKeys } from '../api/plans'
import { RequireAccount } from '../features/shell/RequireAccount'
import { demoPlan } from '../test/fixtures/demoPlan'
import { freshClient } from '../test/render'
import { LocationProbe } from '../test/LocationProbe'
import { renderApp } from '../test/renderApp'
import { AUTH, ME, PLANS, server, signedIn, visitor } from '../test/server'

describe('routes', () => {
  it('says so for an address that leads nowhere, with a way back', async () => {
    renderApp('/no/such/page')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Plan a trip' }))
    expect(screen.getByRole('heading', { name: 'Plan a weather-aware trip' })).toBeInTheDocument()
  })

  it('opens the planner clear, even if a plan was on screen', async () => {
    const client = freshClient()
    client.setQueryData(planKeys.current(), demoPlan)

    renderApp('/', client)

    await waitFor(() => {
      expect(client.getQueryData(planKeys.current())).toBeUndefined()
    })
    expect(screen.queryByRole('list', { name: 'Ranked routes' })).not.toBeInTheDocument()
  })

  it('makes one trip however fast Plan is clicked twice', async () => {
    let plans = 0
    server.use(
      http.post(PLANS, async () => {
        plans += 1
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(demoPlan)
      }),
    )
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Use the demo trip' }))

    await userEvent.dblClick(screen.getByRole('button', { name: 'Plan trip' }))

    await screen.findByRole('list', { name: 'Ranked routes' })
    expect(plans).toBe(1)
  })
})

describe('signed-in header', () => {
  it('shows the user and logs out without a reload', async () => {
    let session = signedIn()
    const signOuts: string[] = []
    server.use(
      http.get(ME, () => HttpResponse.json(session)),
      http.delete(`${AUTH}/session`, ({ request }) => {
        signOuts.push(request.headers.get('X-CSRFToken') ?? '')
        session = visitor
        return HttpResponse.json({ status: 401 }, { status: 401 })
      }),
    )
    document.cookie = 'csrftoken=token-123'
    renderApp('/no/such/page')

    expect(await screen.findByText('driver@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => {
      expect(screen.queryByText('driver@example.com')).not.toBeInTheDocument()
    })
    expect(signOuts).toEqual(['token-123'])
    // Back to the planner, once who's signed in has been fetched again.
    expect(
      await screen.findByRole('heading', { name: 'Plan a weather-aware trip' }),
    ).toBeInTheDocument()
  })
})

describe('pages for signed-in users only', () => {
  function renderGuarded(path: string) {
    const router = createMemoryRouter(
      [
        {
          path: '/trips',
          element: (
            <RequireAccount>
              <p>My trips</p>
            </RequireAccount>
          ),
        },
        { path: '/login', element: <LocationProbe /> },
      ],
      { initialEntries: [path] },
    )
    render(
      <QueryClientProvider client={freshClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )
  }

  it('send a visitor to log in, and back here afterwards', async () => {
    renderGuarded('/trips?saved=true')

    expect(await screen.findByRole('status', { name: 'Location' })).toHaveTextContent(
      '/login?next=%2Ftrips%3Fsaved%3Dtrue',
    )
  })

  it('open for a signed-in user', async () => {
    server.use(http.get(ME, () => HttpResponse.json(signedIn())))

    renderGuarded('/trips')

    expect(await screen.findByText('My trips')).toBeInTheDocument()
  })

  it("say so when sign-in can't be checked", async () => {
    server.use(http.get(ME, () => HttpResponse.error()))

    renderGuarded('/trips')

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't check")
  })
})
