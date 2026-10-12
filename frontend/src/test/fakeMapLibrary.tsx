/** The components of the stand-in map; see fakeMap.ts. */
import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'
import { vi } from 'vitest'

import { fake, type FakeProps } from './fakeMap'

const SourceContext = createContext<string | null>(null)

// The app reaches the map through useMap(), never a ref, so none is offered.
export function Map({ children, ...props }: FakeProps) {
  useLayoutEffect(() => {
    fake.mapProps = props
  })
  return (
    <div data-testid="map" data-style={String(props.mapStyle)}>
      {children}
    </div>
  )
}

/** Like react-map-gl, a change of `data` becomes `setData` on the existing source. */
export function Source({ children, ...props }: FakeProps) {
  const id = String(props.id)
  useLayoutEffect(() => {
    const existing = fake.sources.get(id)
    if (!existing) {
      fake.sources.set(id, { props, setData: vi.fn() })
      return
    }
    if (existing.props.data !== props.data) existing.setData(props.data)
    existing.props = props
  })
  return <SourceContext.Provider value={id}>{children}</SourceContext.Provider>
}

export function Layer(props: FakeProps) {
  const sourceId = useContext(SourceContext)
  useLayoutEffect(() => {
    fake.layers.set(String(props.id), { ...props, source: sourceId })
  })
  return null
}

interface MarkerProps {
  longitude: number
  latitude: number
  children?: ReactNode
}

export function Marker({ children, longitude, latitude }: MarkerProps) {
  return (
    <div data-testid="marker" data-lnglat={`${String(longitude)},${String(latitude)}`}>
      {children}
    </div>
  )
}

interface PopupProps {
  longitude: number
  latitude: number
  closeButton?: boolean
  onClose?: () => void
  children?: ReactNode
}

export function Popup({ children, longitude, latitude, closeButton = true, onClose }: PopupProps) {
  return (
    <div data-testid="popup" data-lnglat={`${String(longitude)},${String(latitude)}`}>
      {children}
      {closeButton && (
        <button type="button" aria-label="Close popup" onClick={() => onClose?.()}>
          ×
        </button>
      )}
    </div>
  )
}

export function NavigationControl() {
  return null
}
