import { create } from 'zustand'
import { ApiError, api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'

interface ArchetypeInfo {
  id: string
  name: string
  name_en: string
  icon: string
  description: string
}

interface QuadrantScores {
  mainstream_independent: number
  rational_emotional: number
  light_dark: number
}

interface DnaResult {
  archetype: ArchetypeInfo
  tag_vector: number[]
  tag_labels: Record<string, number>
  genre_vector: Record<string, number>
  quadrant_scores: QuadrantScores
  personality_reading: string | null
  hidden_traits: string[]
  conversation_style: string | null
  ideal_movie_date: string | null
  ticket_style: string
  can_extend: boolean
}

interface DnaState {
  result: DnaResult | null
  isBuilding: boolean
  isLoading: boolean
  error: string | null

  buildDna: () => Promise<DnaResult | null>
  fetchResult: () => Promise<DnaResult | null>
}

async function autoAssignTheaters(): Promise<void> {
  try {
    await api('/groups/auto-assign', { method: 'POST' })
  } catch {
    // Theater assignment should not block DNA completion.
  }
}

export const useDnaStore = create<DnaState>((set, get) => ({
  result: null,
  isBuilding: false,
  isLoading: false,
  error: null,

  buildDna: async () => {
    set({ isBuilding: true, error: null })
    try {
      const res = await api<{ status: string }>('/dna/build', { method: 'POST' })
      if (res.status === 'ready') {
        const result = await get().fetchResult()
        if (result) {
          await autoAssignTheaters()
        }
        set({ isBuilding: false })
        return result
      }
      set({ isBuilding: false })
      return null
    } catch (err) {
      set({
        isBuilding: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
      return null
    }
  },

  fetchResult: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await api<DnaResult>('/dna/result')
      set({ result, isLoading: false })
      return result
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        set({ result: null, isLoading: false, error: null })
        return null
      }

      set({
        isLoading: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
      throw err
    }
  },
}))
