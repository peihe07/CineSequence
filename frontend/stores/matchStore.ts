import { create } from 'zustand'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'

export interface MatchItem {
  id: string
  partner_id: string
  partner_name: string
  partner_email: string | null
  partner_bio: string | null
  partner_avatar_url: string | null
  partner_archetype: string | null
  similarity_score: number
  candidate_percentile: number | null
  candidate_pool_size: number | null
  shared_tags: string[]
  ice_breakers: string[]
  status: 'discovered' | 'invited' | 'accepted' | 'declined'
  ticket_image_url: string | null
  is_recipient: boolean
}

interface MatchState {
  matches: MatchItem[]
  isLoading: boolean
  isDiscovering: boolean
  error: string | null
  hasHydrated: boolean
  lastFetchedAt: number | null

  fetchMatches: (options?: { background?: boolean; force?: boolean }) => Promise<void>
  fetchMatch: (matchId: string) => Promise<MatchItem | null>
  discoverMatches: () => Promise<void>
  sendInvite: (matchId: string) => Promise<void>
  respondToInvite: (matchId: string, accept: boolean) => Promise<void>
}

const MATCH_CACHE_TTL_MS = 30_000
let inflightMatchesRequest: Promise<void> | null = null

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  isLoading: false,
  isDiscovering: false,
  error: null,
  hasHydrated: false,
  lastFetchedAt: null,

  fetchMatches: async (options) => {
    const background = options?.background ?? false
    const { hasHydrated, lastFetchedAt, isLoading } = get()
    const shouldUseCache = !options?.force
      && hasHydrated
      && lastFetchedAt !== null
      && Date.now() - lastFetchedAt < MATCH_CACHE_TTL_MS

    if (shouldUseCache) return
    if (inflightMatchesRequest) return inflightMatchesRequest

    if (!background && !isLoading) {
      set({ isLoading: true, error: null })
    } else if (!background) {
      set({ error: null })
    }

    inflightMatchesRequest = (async () => {
      try {
        const matches = await api<MatchItem[]>('/matches')
        set({ matches, isLoading: false, hasHydrated: true, lastFetchedAt: Date.now() })
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : translateStatic('common.error'),
          hasHydrated: true,
          lastFetchedAt: Date.now(),
        })
      } finally {
        inflightMatchesRequest = null
      }
    })()

    return inflightMatchesRequest
  },

  fetchMatch: async (matchId: string) => {
    try {
      const match = await api<MatchItem>(`/matches/${matchId}`)
      return match
    } catch {
      return null
    }
  },

  discoverMatches: async () => {
    set({ isDiscovering: true, error: null })
    try {
      const newMatches = await api<MatchItem[]>('/matches/discover', { method: 'POST' })
      const existing = get().matches
      const existingIds = new Set(existing.map((m) => m.id))
      const merged = [...existing, ...newMatches.filter((m) => !existingIds.has(m.id))]
      set({
        matches: merged,
        isDiscovering: false,
        hasHydrated: true,
        lastFetchedAt: Date.now(),
      })
    } catch (err) {
      set({
        isDiscovering: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
    }
  },

  sendInvite: async (matchId: string) => {
    try {
      const updated = await api<MatchItem>('/matches/invite', {
        method: 'POST',
        body: JSON.stringify({ match_id: matchId }),
      })
      set({
        matches: get().matches.map((m) => (m.id === matchId ? updated : m)),
        lastFetchedAt: Date.now(),
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : translateStatic('common.error') })
      throw err
    }
  },

  respondToInvite: async (matchId: string, accept: boolean) => {
    try {
      const updated = await api<MatchItem>('/matches/respond', {
        method: 'POST',
        body: JSON.stringify({ match_id: matchId, accept }),
      })
      set({
        matches: get().matches.map((m) => (m.id === matchId ? updated : m)),
        lastFetchedAt: Date.now(),
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : translateStatic('common.error') })
    }
  },
}))
