/**
 * The selected route's checkpoints: where, when, the weather there and then,
 * and the rating it gave (PRD §7.4). Rows are virtualised so a coast-to-coast
 * route at 10 mi spacing (300+ rows) scrolls smoothly; spacer rows above and
 * below the visible ones keep it a real table for assistive technology.
 */
import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useRef } from 'react'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { formatClockTime, formatNumber } from '../../lib/format'
import { riskStyle } from '../../lib/risk'
import { browserZone, zoneAbbreviation } from '../../lib/time'
import { useUiStore } from '../../state/ui'

type Checkpoint = Plan['routes'][number]['checkpoints'][number]

export const ROW_HEIGHT = 36
const VIEWPORT_HEIGHT = 360

const DRIVER = { wind: 'gusts', rain: 'rain', snow: 'snow' } as const

export function CheckpointTable() {
  const routeId = useUiStore((s) => s.selectedRouteId)
  const select = useCallback(
    (plan: Plan) => {
      const route = plan.routes.find((r) => r.id === routeId)
      return route
        ? {
            name: route.name,
            checkpoints: route.checkpoints,
            zone: plan.inputs.origin.tz ?? browserZone(),
          }
        : null
    },
    [routeId],
  )
  const data = usePlan(select)
  if (!data || routeId === null) return null

  return (
    <section aria-labelledby="checkpoints-title">
      <h2 id="checkpoints-title" className="text-sm font-semibold">
        Checkpoints <span className="font-normal text-muted">· {data.name}</span>
      </h2>
      {/* Keyed by route, so another route's list starts at its first row. Rows are
          rendered only near the scroll position, and Tab can reach only rendered
          rows, so a list left scrolled would hide its first rows from the keyboard. */}
      <Rows key={routeId} routeId={routeId} checkpoints={data.checkpoints} zone={data.zone} />
    </section>
  )
}

interface RowsProps {
  routeId: string
  checkpoints: readonly Checkpoint[]
  zone: string
}

function Rows({ routeId, checkpoints, zone }: RowsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // The project doesn't use the React Compiler, and the virtualiser is meant to
  // re-render this list on scroll.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: checkpoints.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    initialRect: { width: 0, height: VIEWPORT_HEIGHT },
  })
  const items = virtualizer.getVirtualItems()
  // The zone goes in the heading; a row repeats it only if it differs (a DST change en route).
  const headerZone = checkpoints[0] ? zoneAbbreviation(new Date(checkpoints[0].eta), zone) : ''
  const top = items[0]?.start ?? 0
  const bottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0)

  return (
    <div
      ref={scrollRef}
      className="mt-2 overflow-y-auto rounded-card border border-line"
      style={{ maxHeight: VIEWPORT_HEIGHT }}
    >
      <table className="tabular w-full text-xs" aria-rowcount={checkpoints.length + 1}>
        <thead className="sticky top-0 z-10 bg-surface-raised text-left text-muted">
          <tr aria-rowindex={1}>
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium">
              Mile
            </th>
            <th scope="col" className="px-1.5 py-1.5 font-medium">
              ETA <span className="font-normal">{headerZone}</span>
            </th>
            <th
              scope="col"
              className="px-1.5 py-1.5 text-right font-medium"
              title="Sustained / gust"
            >
              Wind <span className="font-normal">mph</span>
            </th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium">
              Rain <span className="font-normal">in/h</span>
            </th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium">
              Snow <span className="font-normal">in/h</span>
            </th>
            <th scope="col" className="px-1.5 py-1.5 font-medium">
              Risk
            </th>
          </tr>
        </thead>
        <tbody>
          {top > 0 && (
            <tr aria-hidden="true">
              <td colSpan={6} style={{ height: top, padding: 0 }} />
            </tr>
          )}
          {items.map((item) => {
            const cp = checkpoints[item.index]
            return cp ? (
              <Row
                key={item.key}
                routeId={routeId}
                index={item.index}
                cp={cp}
                zone={zone}
                headerZone={headerZone}
              />
            ) : null
          })}
          {bottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={6} style={{ height: bottom, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface RowProps {
  routeId: string
  index: number
  cp: Checkpoint
  zone: string
  headerZone: string
}

const Row = memo(function Row({ routeId, index, cp, zone, headerZone }: RowProps) {
  const selected = useUiStore(
    (s) => s.selectedCheckpoint?.routeId === routeId && s.selectedCheckpoint.index === index,
  )
  const selectCheckpoint = useUiStore((s) => s.selectCheckpoint)
  const hoverCheckpoint = useUiStore((s) => s.hoverCheckpoint)
  const risk = riskStyle(cp.risk.level)
  const f = cp.forecast
  const rowZone = zoneAbbreviation(new Date(cp.eta), zone)
  const choose = () => {
    selectCheckpoint({ routeId, index })
  }

  return (
    <tr
      aria-rowindex={index + 2}
      aria-selected={selected}
      tabIndex={0}
      onClick={choose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          choose()
        }
      }}
      onMouseEnter={() => {
        hoverCheckpoint({ routeId, index })
      }}
      onMouseLeave={() => {
        hoverCheckpoint(null)
      }}
      style={{ height: ROW_HEIGHT }}
      className="cursor-pointer border-t border-line hover:bg-surface-raised aria-selected:bg-accent/15"
    >
      <td className="px-1.5 text-right">{Math.round(cp.mile)}</td>
      <td className="px-1.5 whitespace-nowrap">
        {formatClockTime(cp.eta, zone, false)}
        {rowZone !== headerZone && <span className="text-muted"> {rowZone}</span>}
      </td>
      <td className="px-1.5 text-right whitespace-nowrap">
        {f && f.gust_mph !== null ? (
          <>
            <span className="text-muted">
              {f.wind_mph === null ? '–' : f.wind_mph.toFixed(0)} /{' '}
            </span>
            {f.gust_mph.toFixed(0)}
          </>
        ) : (
          'No data'
        )}
      </td>
      <td className="px-1.5 text-right">{formatNumber(f?.rain_in_hr, 2)}</td>
      <td className="px-1.5 text-right">{formatNumber(f?.snow_in_hr, 1)}</td>
      <td className="px-1.5 leading-tight">
        <span
          className="rounded px-1.5 py-px font-medium whitespace-nowrap"
          style={{ backgroundColor: risk.color, color: risk.ink }}
        >
          {risk.label}
        </span>
        {(cp.risk.driver ?? cp.risk.load_rule) && (
          <span className="block text-[10px] whitespace-nowrap text-muted">
            {cp.risk.driver && DRIVER[cp.risk.driver]}
            {cp.risk.load_rule && (
              <span title="Raised by the load rule for heavy trucks"> · load</span>
            )}
          </span>
        )}
      </td>
    </tr>
  )
})
