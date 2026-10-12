/**
 * A stand-in for `react-map-gl/maplibre`, installed for every test in
 * setup.ts: jsdom has no WebGL, so the real map can't start. The components
 * are in fakeMapLibrary.tsx; this file holds what they record and the
 * helpers tests use to read it.
 *
 * Recorded: the Map's props (to fire its event handlers), each Source's data
 * and every `setData` call, each Layer's props, and spies for the camera and
 * feature-state methods.
 */
import type { ReactNode } from 'react'
import { vi, type Mock } from 'vitest'

export interface FakeProps {
  children?: ReactNode
  [prop: string]: unknown
}

function createFakeMap() {
  const canvas = document.createElement('canvas')
  const map = {
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    setFeatureState: vi.fn(),
    removeFeatureState: vi.fn(),
    getContainer: () => ({ clientWidth: 800, clientHeight: 600 }),
    getCanvas: () => canvas,
    /** Everything is in view unless a test says otherwise. */
    getBounds: vi.fn(() => ({ contains: (): boolean => true })),
    getSource: (id: string) => (fake.sources.has(id) ? {} : undefined),
    on: vi.fn(),
    off: vi.fn(),
    getMap: () => map,
  }
  return map
}

export interface FakeSource {
  props: FakeProps
  setData: Mock<(data: unknown) => void>
}

export const fake = {
  map: createFakeMap(),
  mapProps: {} as FakeProps,
  sources: new Map<string, FakeSource>(),
  layers: new Map<string, FakeProps>(),
}

export function resetFakeMap(): void {
  fake.map = createFakeMap()
  fake.mapProps = {}
  fake.sources.clear()
  fake.layers.clear()
}

/** The layer's props as the map last received them; fails the test if it isn't there. */
export function layer(id: string): FakeProps {
  const props = fake.layers.get(id)
  if (!props) throw new Error(`no layer "${id}" on the map`)
  return props
}

export function source(id: string): FakeSource {
  const record = fake.sources.get(id)
  if (!record) throw new Error(`no source "${id}" on the map`)
  return record
}

/** Calls one of the Map's event props, as MapLibre would. */
export function fireMap(handler: string, event: Record<string, unknown> = {}): void {
  const fn = fake.mapProps[handler]
  if (typeof fn !== 'function') throw new Error(`the map has no ${handler} handler`)
  ;(fn as (e: Record<string, unknown>) => void)(event)
}

export function useMap() {
  return { current: fake.map }
}
