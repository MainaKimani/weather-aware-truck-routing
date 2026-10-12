import { Link } from 'react-router'

interface NotFoundProps {
  title?: string
  children?: string
}

/** A page or trip that isn't there (or isn't this caller's to see). */
export function NotFound({
  title = 'Page not found',
  children = "There's nothing at this address.",
}: NotFoundProps) {
  return (
    <section aria-labelledby="not-found-title" className="space-y-3 py-8 text-center">
      <h2 id="not-found-title" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted">{children}</p>
      <p>
        <Link
          to="/"
          className="inline-block rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Plan a trip
        </Link>
      </p>
    </section>
  )
}
