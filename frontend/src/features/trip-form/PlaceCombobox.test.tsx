import { act, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { renderWithClient } from '../../test/render'
import { PlaceCombobox } from './PlaceCombobox'
import type { PlaceValue } from './schema'

function Harness() {
  const [value, setValue] = useState<PlaceValue>({ text: '', place: null })
  return <PlaceCombobox label="Origin" name="origin" value={value} onChange={setValue} />
}

describe('PlaceCombobox', () => {
  it('keeps every character when keys arrive faster than effects run', async () => {
    renderHarness()
    const input = screen.getByRole('combobox', { name: 'Origin' })
    // The native setter, as a browser edit would: React tracks the value it
    // last set and ignores writes through the element's own property.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    input.focus()

    // As a browser does for fast typing: each key edits the DOM value and
    // fires input, with no chance for React effects to run in between.
    const seen: string[] = []
    for (const key of ['d', 'a', 'l']) {
      setValue?.call(input, (input as HTMLInputElement).value + key)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      seen.push((input as HTMLInputElement).value)
    }
    await act(async () => {})

    expect(seen).toEqual(['d', 'da', 'dal'])
    expect(input).toHaveValue('dal')
  })
})

function renderHarness() {
  return renderWithClient(<Harness />)
}
