import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import type { Me } from '../../api/schema'
import { renderApp } from '../../test/renderApp'
import { AUTH, ME, server, signedIn, visitor } from '../../test/server'
import { TOAST_MS } from '../shell/Toaster'
import { safeNext } from './safeNext'

/** A backend whose session changes when the given auth call succeeds. */
function backend(start: Me, after: Me = signedIn()) {
  let me = start
  const bodies: unknown[] = []
  server.use(
    http.get(ME, () => HttpResponse.json(me)),
    ...(['signup', 'login'] as const).map((path) =>
      http.post(`${AUTH}/${path}`, async ({ request }) => {
        bodies.push({ path, body: await request.json() })
        me = after
        return HttpResponse.json({ status: 200 })
      }),
    ),
  )
  return bodies
}

function refuse(
  path: 'signup' | 'login',
  errors: { code: string; message: string; param?: string }[],
) {
  server.use(
    http.post(`${AUTH}/${path}`, () => HttpResponse.json({ status: 400, errors }, { status: 400 })),
  )
}

const email = () => screen.getByLabelText('Email')
const password = () => screen.getByLabelText('Password')

describe('sign up and log in', () => {
  it('signs up with the keyboard alone, then goes where the person was headed', async () => {
    const bodies = backend(visitor)
    renderApp('/signup?next=%2Fno%2Fsuch')
    await screen.findByRole('heading', { name: 'Create an account' })

    await userEvent.tab() // past the header, into the form
    email().focus()
    await userEvent.keyboard('driver@example.com')
    await userEvent.tab()
    expect(password()).toHaveFocus()
    expect(password()).toHaveAccessibleDescription(/At least 8 characters/)
    await userEvent.keyboard('correct-horse-9{Enter}')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(bodies).toEqual([
      { path: 'signup', body: { email: 'driver@example.com', password: 'correct-horse-9' } },
    ])
    expect(screen.getByText('driver@example.com')).toBeInTheDocument()
  })

  it('logs in and goes to the planner when nothing asked otherwise', async () => {
    backend(visitor)
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Log in' })

    await userEvent.type(email(), 'driver@example.com')
    await userEvent.type(password(), 'pw-1234-long{Enter}')

    expect(
      await screen.findByRole('heading', { name: 'Plan a weather-aware trip' }),
    ).toBeInTheDocument()
  })

  it("puts the server's reasons on their fields, announced, and focuses the first", async () => {
    backend(visitor)
    refuse('signup', [
      { code: 'email_taken', message: 'A user is already registered.', param: 'email' },
      { code: 'password_too_common', message: 'This password is too common.', param: 'password' },
    ])
    renderApp('/signup')
    await screen.findByRole('heading', { name: 'Create an account' })

    await userEvent.type(email(), 'driver@example.com')
    await userEvent.type(password(), 'password1{Enter}')

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual([
      'A user is already registered.',
      'This password is too common.',
    ])
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(email()).toHaveAccessibleDescription('A user is already registered.')
    expect(email()).toHaveFocus()
  })

  it('shows a reason that belongs to no field above the form', async () => {
    backend(visitor)
    refuse('login', [{ code: 'too_many_login_attempts', message: 'Too many failed attempts.' }])
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Log in' })

    await userEvent.type(email(), 'driver@example.com')
    await userEvent.type(password(), 'wrong-one{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many failed attempts.')
  })

  it('checks the fields before sending anything', async () => {
    const bodies = backend(visitor)
    renderApp('/signup')
    await screen.findByRole('heading', { name: 'Create an account' })

    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    await userEvent.type(email(), 'not-an-email')
    await userEvent.type(password(), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(bodies).toEqual([])
  })

  it.each([
    [3, '3 trips from this device were added to your account.'],
    [1, '1 trip from this device was added to your account.'],
  ])('tells a guest with %i trips they are in the account now', async (trips, message) => {
    backend(
      { user: null, guest: true, recent_trip_count: trips },
      signedIn('driver@example.com', trips),
    )
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Log in' })

    await userEvent.type(email(), 'driver@example.com')
    await userEvent.type(password(), 'pw-1234-long{Enter}')

    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('says nothing about trips when there were none', async () => {
    backend(visitor)
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Log in' })

    await userEvent.type(email(), 'driver@example.com')
    await userEvent.type(password(), 'pw-1234-long{Enter}')

    await screen.findByRole('heading', { name: 'Plan a weather-aware trip' })
    expect(screen.queryByText(/from this device/)).not.toBeInTheDocument()
  })

  it('lets the message go by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      backend({ user: null, guest: true, recent_trip_count: 2 })
      renderApp('/login')
      await screen.findByRole('heading', { name: 'Log in' })
      await userEvent.type(email(), 'driver@example.com')
      await userEvent.type(password(), 'pw-1234-long{Enter}')
      const toast = await screen.findByText(/trips from this device/)

      act(() => {
        vi.advanceTimersByTime(TOAST_MS)
      })

      await waitFor(() => {
        expect(toast).not.toBeInTheDocument()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends someone already signed in straight on', async () => {
    server.use(http.get(ME, () => HttpResponse.json(signedIn())))

    renderApp('/login?next=%2Fno%2Fsuch')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('keeps where to go next when switching between the two pages', async () => {
    renderApp('/login?next=%2Ftrips')

    const link = await screen.findByRole('link', { name: 'Create an account' })

    expect(link).toHaveAttribute('href', '/signup?next=%2Ftrips')
  })

  it('offers both in the header to anyone not signed in', async () => {
    renderApp('/no/page')

    const header = screen.getByRole('banner')
    expect(await within(header).findByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(within(header).getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
  })
})

describe('where to go after signing in', () => {
  it.each([
    ['/trips', '/trips'],
    ['/trips/abc?x=1', '/trips/abc?x=1'],
    [null, '/'],
    ['', '/'],
    ['https://evil.example/', '/'],
    ['//evil.example/', '/'],
    ['/\\evil.example', '/'],
    ['trips', '/'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected)
  })
})
