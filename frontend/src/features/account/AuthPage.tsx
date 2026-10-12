/**
 * Log in and sign up (RFC §7.5): email and password, errors next to the
 * field they're about and announced, then back to where the person was.
 * Trips planned as a guest on this device move into the account, and a
 * message says how many.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'

import { useLogIn, useSignUp, type AuthError } from '../../api/auth'
import { meKeys, useMe } from '../../api/me'
import type { Me } from '../../api/schema'
import { useToastStore } from '../../state/toasts'
import { FieldError, inputClass } from '../trip-form/fields'
import { safeNext } from './safeNext'

type Mode = 'login' | 'signup'

const COPY: Record<Mode, { title: string; submit: string; busy: string }> = {
  login: { title: 'Log in', submit: 'Log in', busy: 'Logging in…' },
  signup: { title: 'Create an account', submit: 'Sign up', busy: 'Signing up…' },
}

/** Django's validators (RFC §12), in words. */
const PASSWORD_HINT = 'At least 8 characters, not all numbers, and not a common password.'

const schema = (mode: Mode) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, 'Enter your email address.')
      .pipe(z.email({ error: 'Enter a valid email address.' })),
    password:
      mode === 'signup'
        ? z.string().min(8, 'Use at least 8 characters.')
        : z.string().min(1, 'Enter your password.'),
  })

type Values = z.infer<ReturnType<typeof schema>>

export function AuthPage({ mode }: { mode: Mode }) {
  const me = useMe()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const copy = COPY[mode]

  // Already signed in (or just now): on to where they were going.
  if (me.data?.user) return <Navigate to={next} replace />
  return (
    <section aria-labelledby="auth-title" className="mx-auto max-w-sm space-y-5 py-4">
      <h2 id="auth-title" className="text-xl font-semibold">
        {copy.title}
      </h2>
      <AuthForm mode={mode} next={next} />
      <p className="text-sm text-muted">
        {mode === 'login' ? 'New here? ' : 'Have an account? '}
        <Link
          to={`/${mode === 'login' ? 'signup' : 'login'}${params.size ? `?${params.toString()}` : ''}`}
          className="font-medium text-accent underline"
        >
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </section>
  )
}

function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const showToast = useToastStore((s) => s.show)
  const logIn = useLogIn()
  const signUp = useSignUp()
  const mutation = mode === 'login' ? logIn : signUp
  const ids = { email: useId(), password: useId(), hint: useId(), form: useId() }
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema(mode)) as Resolver<Values>,
    defaultValues: { email: '', password: '' },
  })
  const { errors } = formState

  const submit = handleSubmit((values) => {
    // A guest's trips move into the account; how many they had says how many moved.
    const before = queryClient.getQueryData<Me>(meKeys.all)
    const moved = before?.guest ? before.recent_trip_count : 0
    mutation.mutate(values, {
      onSuccess: () => {
        if (moved > 0) {
          showToast(
            `${String(moved)} ${moved === 1 ? 'trip' : 'trips'} from this device ${moved === 1 ? 'was' : 'were'} added to your account.`,
          )
        }
        void navigate(next, { replace: true })
      },
    })
  })

  // The server's reasons go on the fields they name, the first one focused.
  useEffect(() => {
    const error: AuthError | null = mutation.error
    if (!error) return
    const byField = error.byField()
    let focused = false
    for (const field of ['email', 'password'] as const) {
      const messages = byField[field]
      if (!messages) continue
      setError(field, { type: 'server', message: messages.join(' ') }, { shouldFocus: !focused })
      focused = true
    }
  }, [mutation.error, setError])

  const formErrors = mutation.error?.byField().form
  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      aria-labelledby="auth-title"
      className="space-y-4"
    >
      {formErrors && (
        <p
          id={ids.form}
          role="alert"
          className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm"
        >
          {formErrors.join(' ')}
        </p>
      )}
      <div>
        <label htmlFor={ids.email} className="text-sm font-medium">
          Email
        </label>
        <input
          id={ids.email}
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${ids.email}-error` : undefined}
          className={inputClass}
          {...register('email')}
        />
        <FieldError id={`${ids.email}-error`} message={errors.email?.message} alert />
      </div>
      <div>
        <label htmlFor={ids.password} className="text-sm font-medium">
          Password
        </label>
        <input
          id={ids.password}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={
            [errors.password && `${ids.password}-error`, mode === 'signup' && ids.hint]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={inputClass}
          {...register('password')}
        />
        <FieldError id={`${ids.password}-error`} message={errors.password?.message} alert />
        {mode === 'signup' && (
          <p id={ids.hint} className="mt-1 text-xs text-muted">
            {PASSWORD_HINT}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {mutation.isPending ? COPY[mode].busy : COPY[mode].submit}
      </button>
    </form>
  )
}
