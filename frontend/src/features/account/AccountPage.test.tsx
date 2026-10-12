import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Me } from '../../api/schema'
import { renderApp } from '../../test/renderApp'
import { AUTH, ME, apiError, server, signedIn, visitor } from '../../test/server'

/** A signed-in user whose account can be deleted with `password`. */
function serveAccount(password = 'correct-horse-9') {
  let me: Me = signedIn('driver@example.com', 3)
  const deletes: { body: unknown; token: string | null }[] = []
  server.use(
    http.get(ME, () => HttpResponse.json(me)),
    http.delete(ME, async ({ request }) => {
      const body = (await request.json()) as { password: string }
      deletes.push({ body, token: request.headers.get('X-CSRFToken') })
      if (body.password !== password) {
        return apiError(400, 'invalid_input', 'Some fields are invalid.', {
          fields: { password: ['The password is not correct.'] },
        })
      }
      me = visitor
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(`${AUTH}/session`, () => {
      me = visitor
      return HttpResponse.json({ status: 401 }, { status: 401 })
    }),
  )
  return deletes
}

const password = () => screen.getByLabelText('Password')

describe('account page', () => {
  it('shows who is signed in, linked from the header', async () => {
    serveAccount()
    renderApp('/no/page')

    await userEvent.click(await screen.findByRole('link', { name: /driver@example\.com/ }))

    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('Signed in as').nextSibling).toHaveTextContent('driver@example.com')
  })

  it('logs out to the planner', async () => {
    serveAccount()
    renderApp('/account')
    const page = await screen.findByRole('region', { name: 'Account' })

    await userEvent.click(within(page).getByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByRole('heading', { name: 'Plan a weather-aware trip' }),
    ).toBeInTheDocument()
  })

  it('asks for the password before anything else', async () => {
    const deletes = serveAccount()
    renderApp('/account')
    await screen.findByRole('heading', { name: 'Account' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deletes).toEqual([])
  })

  it('puts a wrong password back on its field, announced, and deletes nothing', async () => {
    const deletes = serveAccount()
    renderApp('/account')
    await screen.findByRole('heading', { name: 'Account' })

    await userEvent.type(password(), 'wrong-one-1')
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete everything' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The password is not correct.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(password()).toHaveAttribute('aria-invalid', 'true')
    expect(deletes).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
  })

  it('deletes after asking, and lands on the planner as a guest with no recent trips', async () => {
    const deletes = serveAccount()
    document.cookie = 'csrftoken=token-9'
    const { client } = renderApp('/account')
    await screen.findByRole('heading', { name: 'Account' })
    client.setQueryData(['trips', 'list', 'recent'], { next: null, previous: null, results: [] })

    await userEvent.type(password(), 'correct-horse-9')
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete your account?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete everything' }))

    expect(
      await screen.findByRole('heading', { name: 'Plan a weather-aware trip' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Your account and its trips were deleted.')).toBeInTheDocument()
    expect(deletes).toEqual([{ body: { password: 'correct-horse-9' }, token: 'token-9' }])
    await waitFor(() => {
      expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Log in' })).toBeVisible()
    })
    expect(screen.queryByRole('button', { name: /^Recent trips/ })).not.toBeInTheDocument()
    // No trip data survives (queries may exist again, disabled and empty, for the planner).
    const tripData = client
      .getQueryCache()
      .findAll({ queryKey: ['trips'] })
      .map((query) => query.state.data)
    expect(tripData.filter((data) => data !== undefined)).toEqual([])
  })

  it('is for signed-in users: anyone else is asked to log in first', async () => {
    renderApp('/account')

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})
