/**
 * What an owner can do with a trip, wherever it is shown (My trips, the
 * trip's page): rename, save, share, copy its link, delete. Each confirms
 * or reports in a toast.
 */
import { useCallback } from 'react'

import type { ApiError } from '../../api/errors'
import { useDeleteTrip, useUpdateTrip } from '../../api/trips'
import { useToastStore } from '../../state/toasts'

export function tripLink(tripId: string): string {
  return `${window.location.origin}/trips/${tripId}`
}

export function useTripActions(tripId: string) {
  const showToast = useToastStore((s) => s.show)
  const update = useUpdateTrip()
  const remove = useDeleteTrip()
  const failed = useCallback(
    (error: ApiError) => {
      showToast(error.message)
    },
    [showToast],
  )

  return {
    update,
    remove,
    rename: (name: string, onDone?: () => void) => {
      update.mutate({ tripId, changes: { name } }, { onSuccess: onDone, onError: failed })
    },
    /** Save under a name, in one request. */
    saveAs: (name: string, onDone?: () => void) => {
      update.mutate(
        { tripId, changes: { name, saved: true } },
        {
          onSuccess: () => {
            showToast('Trip saved. It stays until you delete it.')
            onDone?.()
          },
          onError: failed,
        },
      )
    },
    setSaved: (saved: boolean) => {
      update.mutate({ tripId, changes: { saved } }, { onError: failed })
    },
    setShared: (shared: boolean) => {
      update.mutate(
        { tripId, changes: { shared } },
        {
          onSuccess: () => {
            showToast(
              shared
                ? 'Sharing is on: anyone with the link can see this trip.'
                : 'Sharing is off: the link no longer opens this trip for anyone else.',
            )
          },
          onError: failed,
        },
      )
    },
    copyLink: async () => {
      const link = tripLink(tripId)
      try {
        await navigator.clipboard.writeText(link)
        showToast('Link copied.')
      } catch {
        showToast(`Couldn't copy it; the link is ${link}`)
      }
    },
    deleteTrip: (onDone?: () => void) => {
      remove.mutate(tripId, {
        onSuccess: () => {
          showToast('Trip deleted.')
          onDone?.()
        },
      })
    },
  }
}
