/**
 * My trips (PRD §7.9): every trip the user has planned, newest first. Saved
 * ones can be shown alone, and any can be found by name or place. More load
 * as the list is scrolled, or with Load more.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { TripSummary } from '../../api/schema'
import { useTripList } from '../../api/trips'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { formatDateTime } from '../../lib/format'
import { browserZone } from '../../lib/time'
import { ConfirmDialog } from '../shell/ConfirmDialog'
import { inputClass } from '../trip-form/fields'
import { TripSummaryLine } from './TripSummaryLine'
import { tripTitle } from './tripLabels'
import { useTripActions } from './useTripActions'

export const SEARCH_DEBOUNCE_MS = 300

type Tab = 'all' | 'saved'

export function TripsPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const list = useTripList({ saved: tab === 'saved' ? true : undefined, q })
  const searchId = useId()
  const trips = list.data?.pages.flatMap((page) => page.results) ?? []
  const filtered = tab === 'saved' || q !== ''

  return (
    <section aria-labelledby="trips-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="trips-title" className="text-xl font-semibold">
          My trips
        </h2>
        <Link
          to="/"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Plan a trip
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Show" className="flex rounded-md border border-line p-0.5">
          {(['all', 'saved'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t)
              }}
              className="min-h-8 rounded px-3 text-sm font-medium aria-pressed:bg-accent aria-pressed:text-accent-ink"
            >
              {t === 'all' ? 'All' : 'Saved'}
            </button>
          ))}
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search trips
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            placeholder="Search by name or place"
            onChange={(e) => {
              setSearch(e.currentTarget.value)
            }}
            className={`${inputClass} mt-0`}
          />
        </div>
      </div>

      {list.isPending && <p className="text-sm text-muted">Loading your trips…</p>}
      {list.isError && (
        <div role="alert" className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm">
          Couldn't load your trips. {list.error.message}{' '}
          <button
            type="button"
            onClick={() => void list.refetch()}
            className="font-medium underline"
          >
            Try again
          </button>
        </div>
      )}
      {list.isSuccess && trips.length === 0 && <EmptyState filtered={filtered} />}
      {trips.length > 0 && (
        <ul
          aria-label="Trips"
          className="divide-y divide-line rounded-card border border-line bg-surface"
        >
          {trips.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <MoreTrips loading={list.isFetchingNextPage} onMore={() => void list.fetchNextPage()} />
      )}
    </section>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) return <p className="text-sm text-muted">No trips match.</p>
  return (
    <div className="rounded-card border border-line bg-surface p-6 text-center text-sm">
      <p className="font-medium">No trips yet.</p>
      <p className="mt-1 text-muted">
        Every trip you plan is kept here.{' '}
        <Link to="/" className="font-medium text-accent underline">
          Plan your first trip
        </Link>
        .
      </p>
    </div>
  )
}

/** Loads the next page when it scrolls into view, or when pressed. */
function MoreTrips({ loading, onMore }: { loading: boolean; onMore: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) onMore()
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [loading, onMore])
  return (
    <div ref={sentinel} className="flex justify-center">
      <button
        type="button"
        onClick={onMore}
        disabled={loading}
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:opacity-60"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  )
}

function TripRow({ trip }: { trip: TripSummary }) {
  const title = tripTitle(trip)
  const actions = useTripActions(trip.id)
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="flex items-start gap-3 p-3">
      <button
        type="button"
        aria-pressed={trip.saved}
        aria-label={`Save ${title}`}
        title={trip.saved ? 'Saved' : 'Save'}
        onClick={() => {
          actions.setSaved(!trip.saved)
        }}
        className="grid size-8 shrink-0 place-items-center rounded-md text-lg text-muted hover:bg-surface-raised aria-pressed:text-accent"
      >
        <span aria-hidden="true">{trip.saved ? '★' : '☆'}</span>
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        {renaming ? (
          <RenameForm
            title={title}
            name={trip.name}
            busy={actions.update.isPending}
            onSave={(name) => {
              actions.rename(name, () => {
                setRenaming(false)
              })
            }}
            onCancel={() => {
              setRenaming(false)
            }}
          />
        ) : (
          <Link to={`/trips/${trip.id}`} className="block rounded hover:underline">
            <TripSummaryLine trip={trip} />
          </Link>
        )}
        <p className="text-xs text-muted">
          Planned {formatDateTime(trip.created_at, browserZone())}
          {trip.shared && (
            <span className="ml-2 rounded-full border border-line px-1.5 py-px">Shared</span>
          )}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <RowAction
            label="Rename"
            name={title}
            onClick={() => {
              setRenaming(true)
            }}
          />
          <RowAction
            label={trip.shared ? 'Stop sharing' : 'Share'}
            name={title}
            onClick={() => {
              actions.setShared(!trip.shared)
            }}
          />
          {trip.shared && (
            <RowAction label="Copy link" name={title} onClick={() => void actions.copyLink()} />
          )}
          <RowAction
            label="Delete"
            name={title}
            onClick={() => {
              setConfirming(true)
            }}
            danger
          />
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Delete this trip?"
          confirmLabel="Delete trip"
          busy={actions.remove.isPending}
          error={actions.remove.error?.message}
          onCancel={() => {
            setConfirming(false)
          }}
          onConfirm={() => {
            actions.deleteTrip(() => {
              setConfirming(false)
            })
          }}
        >
          {title} will be gone for good
          {trip.shared ? ', and its shared link will stop working' : ''}.
        </ConfirmDialog>
      )}
    </li>
  )
}

/** A row's action, named for screen readers with the trip it acts on. */
function RowAction({
  label,
  name,
  onClick,
  danger = false,
}: {
  label: string
  name: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${name}`}
      onClick={onClick}
      className={`min-h-6 rounded font-medium hover:underline ${danger ? 'text-danger' : 'text-accent'}`}
    >
      {label}
    </button>
  )
}

function RenameForm({
  title,
  name,
  busy,
  onSave,
  onCancel,
}: {
  title: string
  name: string
  busy: boolean
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(name)
  const id = useId()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value.trim())
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor={id} className="sr-only">
        Name for {title}
      </label>
      <input
        id={id}
        value={value}
        maxLength={120}
        autoFocus
        placeholder="Name this trip"
        onChange={(e) => {
          setValue(e.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        className={`${inputClass} mt-0 min-w-48 flex-1`}
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent px-2.5 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        Save name
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-line px-2.5 py-1.5 text-sm font-medium"
      >
        Cancel
      </button>
    </form>
  )
}
