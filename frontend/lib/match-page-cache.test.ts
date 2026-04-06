import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetMatchPageCacheForTests,
  getCachedInviteCredits,
  getCachedMatchPrefs,
  setCachedInviteCredits,
  setCachedMatchPrefs,
} from './match-page-cache'

describe('match-page-cache', () => {
  beforeEach(() => {
    __resetMatchPageCacheForTests()
    vi.useRealTimers()
  })

  it('returns cached match prefs while fresh', () => {
    setCachedMatchPrefs({
      match_gender_pref: 'female',
      match_age_min: 24,
      match_age_max: 35,
      pure_taste_match: false,
    })

    expect(getCachedMatchPrefs()).toEqual({
      match_gender_pref: 'female',
      match_age_min: 24,
      match_age_max: 35,
      pure_taste_match: false,
    })
  })

  it('expires cached invite credits after the ttl', () => {
    vi.useFakeTimers()

    setCachedInviteCredits({ remaining: 2, unlocked: false })
    vi.advanceTimersByTime(30_001)

    expect(getCachedInviteCredits()).toBeNull()
  })
})
