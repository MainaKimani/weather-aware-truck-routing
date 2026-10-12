import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderHookWithClient } from '../test/render'
import { AUTH, ME, server, signedIn, visitor } from '../test/server'
import { AuthError, logIn, logOut, signUp, useLogIn } from './auth'
import { fetchMe, meKeys } from './me'
import type { Me } from './schema'

const credentials = { email: 'driver@example.com', password: 'correct-horse-9' }

describe('allauth client', () => {
  it('sends the credentials as JSON with the CSRF token', async () => {
    let seen: { body: unknown; token: string | null } | null = null
    server.use(
      http.post(`${AUTH}/signup`, async ({ request }) => {
        seen = { body: await request.json(), token: request.headers.get('X-CSRFToken') }
        return HttpResponse.json({ status: 200 })
      }),
    )
    document.cookie = 'csrftoken=abc'

    await signUp(credentials)

    expect(seen).toEqual({ body: credentials, token: 'abc' })
  })

  it("turns allauth's errors into messages by field", async () => {
    server.use(
      http.post(`${AUTH}/signup`, () =>
        HttpResponse.json(
          {
            status: 400,
            errors: [
              { code: 'email_taken', message: 'Already registered.', param: 'email' },
              { code: 'password_too_short', message: 'Too short.', param: 'password' },
              { code: 'password_too_common', message: 'Too common.', param: 'password' },
              { code: 'something', message: 'Generally wrong.' },
            ],
          },
          { status: 400 },
        ),
      ),
    )

    const error = await signUp(credentials).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AuthError)
    const auth = error as AuthError
    expect(auth.has('email_taken')).toBe(true)
    expect(auth.byField()).toEqual({
      email: ['Already registered.'],
      password: ['Too short.', 'Too common.'],
      form: ['Generally wrong.'],
    })
  })

  it.each([
    [
      'a refused CSRF check',
      HttpResponse.json({ error: { code: 'csrf_failed', message: 'Reload.' } }, { status: 403 }),
      'csrf_failed',
    ],
    ['too many attempts', new HttpResponse(null, { status: 429 }), 'rate_limited'],
    ['a proxy page', new HttpResponse('<h1>Bad gateway</h1>', { status: 502 }), 'server_error'],
  ])('reads %s', async (_, response, code) => {
    server.use(http.post(`${AUTH}/login`, () => response))

    const error = (await logIn(credentials).catch((e: unknown) => e)) as AuthError

    expect(error.issues.map((i) => i.code)).toEqual([code])
  })

  it('reports a failed connection', async () => {
    server.use(http.post(`${AUTH}/login`, () => HttpResponse.error()))

    const error = (await logIn(credentials).catch((e: unknown) => e)) as AuthError

    expect(error.issues[0]?.code).toBe('network_error')
  })

  it("treats logging out's 401 as done", async () => {
    server.use(http.delete(`${AUTH}/session`, () => HttpResponse.json({}, { status: 401 })))

    await expect(logOut()).resolves.toBeNull()
  })

  it('logging in fetches who the caller is again', async () => {
    let session: Me = visitor
    server.use(
      http.get(ME, () => HttpResponse.json(session)),
      http.post(`${AUTH}/login`, () => {
        session = signedIn()
        return HttpResponse.json({ status: 200 })
      }),
    )
    const { result, client } = renderHookWithClient(() => useLogIn())
    await client.query({ queryKey: meKeys.all, queryFn: () => fetchMe() })

    act(() => {
      result.current.mutate(credentials)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryState(meKeys.all)?.isInvalidated).toBe(true)
  })
})
