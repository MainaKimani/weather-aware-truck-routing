/**
 * A guest's recent trips (PRD §7.9): the header's way back to what they
 * planned on this device, and the reason to sign up. Signed-in users have
 * My trips instead.
 */
import { useCallback, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { useMe } from '../../api/me'
import { useRecentTrips } from '../../api/trips'
import { TripSummaryLine } from '../trips/TripSummaryLine'
import { useDismiss } from './useDismiss'

export function RecentTripsMenu() {
  const me = useMe().data
  const [open, setOpen] = useState(false)
  const recent = useRecentTrips(open)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = useCallback(() => {
    setOpen(false)
  }, [])
  useDismiss(open, container, trigger, close)

  if (!me || me.user || me.recent_trip_count === 0) return null
  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen(!open)
        }}
        className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm font-medium hover:bg-surface-raised"
      >
        Recent trips
        <span className="tabular rounded-full bg-surface-raised px-1.5 text-xs text-muted">
          {me.recent_trip_count}
        </span>
      </button>
      {open && (
        <section
          id={panelId}
          aria-label="Recent trips"
          // On phones the trigger isn't at the screen's edge, so a panel hung off it
          // would run off the left; it sits centred under the header instead.
          className="fixed top-16 left-1/2 z-30 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-card border border-line bg-surface p-2 shadow-overlay sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-80 sm:translate-x-0"
        >
          {recent.isPending && <p className="p-2 text-sm text-muted">Loading…</p>}
          {recent.isError && (
            <p role="alert" className="p-2 text-sm">
              Couldn't load your trips. Try again in a moment.
            </p>
          )}
          {recent.data && (
            <ul className="max-h-80 overflow-y-auto">
              {recent.data.results.map((trip) => (
                <li key={trip.id}>
                  <Link
                    to={`/trips/${trip.id}`}
                    onClick={close}
                    className="block rounded-md px-2 py-1.5 text-sm hover:bg-surface-raised"
                  >
                    <TripSummaryLine trip={trip} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 border-t border-line px-2 pt-2 text-xs text-muted">
            Trips you plan as a guest stay on this device for 30 days.{' '}
            <Link to="/signup" onClick={close} className="font-medium text-accent underline">
              Sign up to keep these
            </Link>
          </p>
        </section>
      )}
    </div>
  )
}
