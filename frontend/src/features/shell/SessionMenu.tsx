/**
 * Who is signed in, in the header. A signed-in user sees their email and can
 * log out; anyone else can log in or sign up.
 */
import { Link, useNavigate } from 'react-router'

import { useLogOut } from '../../api/auth'
import { useCurrentUser } from '../../api/me'

export function SessionMenu() {
  const user = useCurrentUser()
  const logOut = useLogOut()
  const navigate = useNavigate()

  if (user === undefined) return null
  if (user === null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link to="/login" className="rounded-md px-2 py-1 font-medium hover:bg-surface-raised">
          Log in
        </Link>
        <Link
          to="/signup"
          className="rounded-md bg-accent px-2.5 py-1 font-semibold text-accent-ink hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link to="/trips" className="rounded-md px-2 py-1 font-medium hover:bg-surface-raised">
        My trips
      </Link>
      <Link
        to="/account"
        title={`Account: ${user.email}`}
        className="max-w-48 truncate rounded-md px-2 py-1 text-muted hover:bg-surface-raised"
      >
        {/* The email where there's room; "Account" on a phone. */}
        <span className="sm:hidden">Account</span>
        <span className="hidden sm:inline">{user.email}</span>
      </Link>
      <button
        type="button"
        disabled={logOut.isPending}
        onClick={() => {
          logOut.mutate(undefined, {
            onSuccess: () => {
              void navigate('/')
            },
          })
        }}
        className="rounded-md border border-line px-2.5 py-1 font-medium hover:bg-surface-raised disabled:opacity-60"
      >
        Log out
      </button>
    </div>
  )
}
