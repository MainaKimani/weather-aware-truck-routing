import { AppShell } from './features/shell/AppShell'

export default function App() {
  return (
    <AppShell
      panel={
        <section className="p-5" aria-labelledby="empty-title">
          <h1 id="empty-title" className="text-lg font-semibold">
            Plan a weather-aware trip
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter an origin, destination, departure and load. You'll get up to three routes, each
            rated for wind, rain and snow at the time the truck reaches every checkpoint, with a
            recommendation and the reason for it.
          </p>
        </section>
      }
      map={
        <div className="flex h-full items-center justify-center bg-canvas text-sm text-muted">
          The map appears here once a trip is planned.
        </div>
      }
      timeline={
        <div className="flex h-12 items-center px-4 text-sm text-muted">
          Forecast timeline: 0–48 h from now
        </div>
      }
    />
  )
}
