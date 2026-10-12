/**
 * What can be done with the trip on screen (RFC §7.4). Anyone who can see it
 * can re-plan it with current weather into a trip of their own. Its owner
 * can also save it under a name, share it, copy its link and delete it; a
 * guest who tries to save is asked to make an account first.
 */
import { useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { useCurrentUser } from '../../api/me'
import type { Trip } from '../../api/schema'
import { useReplanTrip } from '../../api/trips'
import { useOpenTrip } from '../planner/useOpenTrip'
import { ConfirmDialog } from '../shell/ConfirmDialog'
import { Modal } from '../shell/Modal'
import { inputClass } from '../trip-form/fields'
import { tripTitle } from '../trips/tripLabels'
import { useTripActions } from '../trips/useTripActions'

const button =
  'min-h-8 rounded-md border border-line px-2.5 py-1 text-sm font-medium hover:bg-surface-raised disabled:opacity-60'

export function TripActions({ trip }: { trip: Trip }) {
  const user = useCurrentUser()
  const replan = useReplanTrip()
  const openTrip = useOpenTrip()
  const navigate = useNavigate()
  const actions = useTripActions(trip.trip_id)
  const [naming, setNaming] = useState(false)
  const [askingToSignUp, setAskingToSignUp] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const title = tripTitle({
    name: trip.name,
    origin: trip.inputs.origin.label,
    destination: trip.inputs.destination.label,
  })

  return (
    <section aria-label="Trip actions" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={replan.isPending}
          aria-busy={replan.isPending}
          onClick={() => {
            replan.mutate(trip.trip_id, { onSuccess: openTrip })
          }}
          className="min-h-8 rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {replan.isPending ? 'Re-planning…' : 'Re-plan with current weather'}
        </button>
        {trip.is_owner && (
          <>
            <button
              type="button"
              aria-pressed={trip.saved}
              onClick={() => {
                if (trip.saved) actions.setSaved(false)
                else if (!user) setAskingToSignUp(true)
                else setNaming(true)
              }}
              className={button}
            >
              {trip.saved ? '★ Saved' : '☆ Save'}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={trip.shared}
              onClick={() => {
                actions.setShared(!trip.shared)
              }}
              className={`${button} flex items-center gap-2`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-7 rounded-full p-0.5 transition-colors ${trip.shared ? 'bg-accent' : 'bg-line'}`}
              >
                <span
                  className={`block size-3 rounded-full bg-surface transition-transform ${trip.shared ? 'translate-x-3' : ''}`}
                />
              </span>
              Share
            </button>
            {trip.shared && (
              <button type="button" onClick={() => void actions.copyLink()} className={button}>
                Copy link
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(true)
              }}
              className={`${button} text-danger`}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {!trip.is_owner && (
        <p className="text-xs text-muted">
          Shared with you, read-only. Re-planning makes a copy of your own with today's weather.
        </p>
      )}
      {replan.error && (
        <p role="alert" className="text-sm text-danger">
          Couldn't re-plan: {replan.error.message}
        </p>
      )}

      {naming && (
        <SaveForm
          defaultName={trip.name || title}
          busy={actions.update.isPending}
          onSave={(name) => {
            actions.saveAs(name, () => {
              setNaming(false)
            })
          }}
          onCancel={() => {
            setNaming(false)
          }}
        />
      )}
      {askingToSignUp && (
        <SignUpToSave
          onClose={() => {
            setAskingToSignUp(false)
          }}
        />
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this trip?"
          confirmLabel="Delete trip"
          busy={actions.remove.isPending}
          error={actions.remove.error?.message}
          onCancel={() => {
            setConfirmingDelete(false)
          }}
          onConfirm={() => {
            actions.deleteTrip(() => {
              void navigate(user ? '/trips' : '/')
            })
          }}
        >
          {title} will be gone for good
          {trip.shared ? ', and its shared link will stop working' : ''}.
        </ConfirmDialog>
      )}
    </section>
  )
}

function SaveForm({
  defaultName,
  busy,
  onSave,
  onCancel,
}: {
  defaultName: string
  busy: boolean
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(defaultName)
  const id = useId()
  return (
    <form
      aria-label="Save trip"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(name.trim())
      }}
      className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-surface-raised p-3"
    >
      <div className="min-w-48 flex-1">
        <label htmlFor={id} className="text-sm font-medium">
          Name
        </label>
        <input
          id={id}
          value={name}
          maxLength={120}
          autoFocus
          onChange={(e) => {
            setName(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
          }}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        Save trip
      </button>
      <button type="button" onClick={onCancel} className={`${button} py-2`}>
        Cancel
      </button>
    </form>
  )
}

/** A guest pressed Save: saving needs an account, and their trips come with them. */
function SignUpToSave({ onClose }: { onClose: () => void }) {
  const here = useLocation().pathname
  const next = `?next=${encodeURIComponent(here)}`
  return (
    <Modal
      title="Create an account to save trips"
      onClose={onClose}
      description="Saved trips stay until you delete them, on any device. The trips you've planned here come with you."
    >
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={button}>
          Not now
        </button>
        <Link to={`/login${next}`} className={button}>
          Log in
        </Link>
        <Link
          to={`/signup${next}`}
          className="min-h-8 rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    </Modal>
  )
}
