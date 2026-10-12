import { useLocation } from 'react-router'

/** Shows where the router is, for tests that check a redirect. */
export function LocationProbe() {
  const { pathname, search } = useLocation()
  return <output aria-label="Location">{`${pathname}${search}`}</output>
}
