import { create } from 'zustand'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'

export interface MatchItem {
  id: string
  partner_id: string
  partner_name: string
  similarity_score: number
  shared_tags: string[]
  ice_breakers: string[]
  status: 'discovered' | 'invited' | 'accepted' | 'declined'
  ticket_image_url: string | null
}

interface MatchState {
  matches: MatchItem[]
  isLoading: boolean
  isDiscovering: boolean
  error: string | null

  fetchMatches: () => Promise<void>
  fetchMatch: (matchId: string) => Promise<MatchItem | null>
  discoverMatches: () => Promise<void>
  sendInvite: (matchId: string) => Promise<void>
  respondToInvite: (matchId: string, accept: boolean) => Promise<void>
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  isLoading: false,
  isDiscovering: false,
  error: null,

  fetchMatches: async () => {
    set({ isLoading: true, error: null })
    try {
      const matches = await api<MatchItem[]>('/matches')
      set({ matches, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
    }
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
      set({ matches: merged, isDiscovering: false })
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
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : translateStatic('common.error') })
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
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : translateStatic('common.error') })
    }
  },
}))
