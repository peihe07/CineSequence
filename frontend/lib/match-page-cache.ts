export interface MatchPrefs {
  match_gender_pref: string | null
  match_age_min: number | null
  match_age_max: number | null
  pure_taste_match: boolean
}

export interface InviteCredits {
  remaining: number
  unlocked: boolean
  daily_limit?: number
}

const MATCH_PAGE_CACHE_TTL_MS = 30_000

let cachedMatchPrefs: (MatchPrefs & { fetchedAt: number }) | null = null
let cachedInviteCredits: (InviteCredits & { fetchedAt: number }) | null = null

export function hasFreshMatchPageCache(fetchedAt: number | null | undefined): boolean {
  return typeof fetchedAt === 'number' && Date.now() - fetchedAt < MATCH_PAGE_CACHE_TTL_MS
}

export function getCachedMatchPrefs(): MatchPrefs | null {
  if (!hasFreshMatchPageCache(cachedMatchPrefs?.fetchedAt)) {
    return null
  }

  return cachedMatchPrefs
    ? {
        match_gender_pref: cachedMatchPrefs.match_gender_pref,
        match_age_min: cachedMatchPrefs.match_age_min,
        match_age_max: cachedMatchPrefs.match_age_max,
        pure_taste_match: cachedMatchPrefs.pure_taste_match,
      }
    : null
}

export function setCachedMatchPrefs(prefs: MatchPrefs): void {
  cachedMatchPrefs = {
    ...prefs,
    fetchedAt: Date.now(),
  }
}

export function getCachedInviteCredits(): InviteCredits | null {
  if (!hasFreshMatchPageCache(cachedInviteCredits?.fetchedAt)) {
    return null
  }

  return cachedInviteCredits
    ? {
        remaining: cachedInviteCredits.remaining,
        unlocked: cachedInviteCredits.unlocked,
      }
    : null
}

export function setCachedInviteCredits(credits: InviteCredits): void {
  cachedInviteCredits = {
    ...credits,
    fetchedAt: Date.now(),
  }
}

export function __resetMatchPageCacheForTests(): void {
  cachedMatchPrefs = null
  cachedInviteCredits = null
}
