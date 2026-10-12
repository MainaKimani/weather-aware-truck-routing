import { describe, expect, it } from 'vitest'

import { decodePolyline } from './polyline'

describe('decodePolyline', () => {
  it("decodes Google's reference example, longitude first", () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })

  it('gives no points for an empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })
})
