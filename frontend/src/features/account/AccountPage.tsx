/**
 * The signed-in user's account (RFC §7.5): their email, logging out, and
 * deleting the account with everything in it, which needs the password and
 * asks once more.
 */
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'

import { logOut as endSession } from '../../api/auth'
import { useCurrentUser, useDeleteAccount } from '../../api/me'
import { useToastStore } from '../../state/toasts'
import { ConfirmDialog } from '../shell/ConfirmDialog'
import { FieldError, inputClass } from '../trip-form/fields'
import type { HandoffState } from './sessionHandoff'

export function AccountPage() {
  const user = useCurrentUser()
  // Not useLogOut: the session refresh waits for the planner (sessionHandoff.ts).
  const logOut = useMutation({ mutationFn: endSession })
  const navigate = useNavigate()

  return (
    <section aria-labelledby="account-title" className="max-w-lg space-y-6">
      <h2 id="account-title" className="text-xl font-semibold">
        Account
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <div className="text-sm">
          <p className="text-muted">Signed in as</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        <button
          type="button"
          disabled={logOut.isPending}
          onClick={() => {
            logOut.mutate(undefined, {
              onSuccess: () => {
                void navigate('/', { state: { sessionEnded: 'signed_out' } satisfies HandoffState })
              },
            })
          }}
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:opacity-60"
        >
          Log out
        </button>
      </div>
      <DangerZone />
    </section>
  )
}

function DangerZone() {
  const remove = useDeleteAccount()
  const navigate = useNavigate()
  const showToast = useToastStore((s) => s.show)
  const [password, setPassword] = useState('')
  const [missing, setMissing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ids = { title: useId(), password: useId() }
  const wrong = remove.error?.fields.password?.join(' ')
  const error = missing ? 'Enter your password to delete the account.' : wrong

  return (
    <section
      aria-labelledby={ids.title}
      className="space-y-3 rounded-card border border-danger/40 p-4"
    >
      <h3 id={ids.title} className="font-semibold text-danger">
        Delete account
      </h3>
      <p className="text-sm text-muted">
        Your account and every trip in it are deleted for good, and shared links stop working.
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setMissing(password === '')
          if (password !== '') setConfirming(true)
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor={ids.password} className="text-sm font-medium">
            Password
          </label>
          <input
            id={ids.password}
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids.password}-error` : undefined}
            onChange={(e) => {
              setPassword(e.currentTarget.value)
              setMissing(false)
            }}
            className={inputClass}
          />
          <FieldError id={`${ids.password}-error`} message={error} alert />
        </div>
        <button
          type="submit"
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-surface hover:opacity-90"
        >
          Delete account
        </button>
      </form>
      {confirming && (
        <ConfirmDialog
          title="Delete your account?"
          confirmLabel="Delete everything"
          busy={remove.isPending}
          error={remove.error && !wrong ? remove.error.message : null}
          onCancel={() => {
            setConfirming(false)
          }}
          onConfirm={() => {
            remove.mutate(password, {
              onSuccess: () => {
                showToast('Your account and its trips were deleted.')
                void navigate('/', { state: { sessionEnded: 'deleted' } satisfies HandoffState })
              },
              onError: (failure) => {
                // A wrong password goes back to its field.
                if (failure.fields.password) setConfirming(false)
              },
            })
          }}
        >
          This can't be undone.
        </ConfirmDialog>
      )}
    </section>
  )
}
