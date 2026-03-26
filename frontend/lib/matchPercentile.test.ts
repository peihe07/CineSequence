import { describe, expect, it } from 'vitest'

import { formatPercentileSummary, getTopPercent } from './matchPercentile'

describe('getTopPercent', () => {
  it('converts percentile standing to an inclusive top-percent bucket', () => {
    expect(getTopPercent(91)).toBe(10)
    expect(getTopPercent(100)).toBe(1)
    expect(getTopPercent(1)).toBe(100)
  })
})

describe('formatPercentileSummary', () => {
  it('returns translated top-percent text using the adjusted bucket', () => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      if (key === 'ticket.percentileAbove') {
        return `Higher than ${vars?.percentile}%`
      }
      if (key === 'ticket.percentileTop') {
        return `Top ${vars?.topPercent}% match`
      }
      return key
    }

    expect(formatPercentileSummary(t, 91)).toEqual({
      above: 'Higher than 91%',
      top: 'Top 10% match',
    })
  })
})
