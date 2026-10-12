/**
 * The basemap and the starting camera. OpenFreeMap serves vector tiles and
 * styles with no key or account, so the map works anywhere the app is
 * deployed. Both styles are muted, so the risk colours drawn on top carry
 * the contrast.
 */
import type { Theme } from '../../lib/theme'

export const BASEMAP: Readonly<Record<Theme, string>> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

/** The contiguous United States, before anything is planned. */
export const INITIAL_VIEW = { longitude: -98.5, latitude: 39.5, zoom: 3.3 } as const

/** Never zoom in past street level when fitting a short trip. */
export const FIT_MAX_ZOOM = 11

/** Height of the destination pin, which stands above the point it marks. */
export const PIN_HEIGHT = 32

/**
 * Space kept clear around the routes when the camera fits them: a fixed
 * margin on a large map, less on a small one so the fit never fails for
 * want of room (MapLibre refuses a fit whose padding exceeds the canvas).
 * The top also clears the destination pin.
 */
export function fitPadding(width: number, height: number) {
  const margin = Math.round(Math.min(56, Math.min(width, height) * 0.12))
  return { top: margin + PIN_HEIGHT, right: margin, bottom: margin, left: margin }
}
