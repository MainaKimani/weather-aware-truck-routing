/**
 * Who is signed in, in the header. A signed-in user sees their email and can
 * log out; everyone else sees nothing here yet.
 */
import { useNavigate } from 'react-router'

import { useLogOut } from '../../api/auth'
import { useCurrentUser } from '../../api/me'

export function SessionMenu() {
  const user = useCurrentUser()
  const logOut = useLogOut()
  const navigate = useNavigate()

  if (!user) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden max-w-48 truncate text-muted sm:inline" title={user.email}>
        {user.email}
      </span>
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
