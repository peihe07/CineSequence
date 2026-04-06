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

interface SignalDetail {
  tag: string
  score: number | null
  confidence: number | null
  consistency: number | null
}

interface ComparisonEvidence {
  round: number | null
  chosen_title: string
  rejected_title: string
  dimension: string | null
  focus_tags: string[]
  chosen_tags: string[]
  rejected_tags: string[]
}

interface InteractionDiagnostics {
  skip_count: number
  dislike_both_count: number
  explicit_pick_count: number
}

export interface DnaResult {
  archetype: ArchetypeInfo
  tag_vector: number[]
  tag_labels: Record<string, number>
  top_tags: string[]
  supporting_signals: SignalDetail[]
  avoided_signals: SignalDetail[]
  mixed_signals: SignalDetail[]
  comparison_evidence: ComparisonEvidence[]
  interaction_diagnostics: InteractionDiagnostics
  genre_vector: Record<string, number>
  quadrant_scores: QuadrantScores
  personality_reading: string | null
  hidden_traits: string[]
  conversation_style: string | null
  ideal_movie_date: string | null
  ticket_style: string
  can_extend: boolean
}

export interface CharacterMatch {
  id: string
  name: string
  movie: string
  movie_zh?: string | null
  tmdb_id: number
  score: number
  psych_labels: string[]
  psych_framework: string
  one_liner: string
  mirror_reading: string | null
}

interface DnaState {
  result: DnaResult | null
  isBuilding: boolean
  isLoading: boolean
  error: string | null
  hasHydrated: boolean
  lastFetchedAt: number | null
  mirrorCharacters: CharacterMatch[] | null
  isMirrorLoading: boolean
  mirrorError: string | null

  buildDna: () => Promise<DnaResult | null>
  fetchResult: (options?: { force?: boolean }) => Promise<DnaResult | null>
  fetchMirror: () => Promise<void>
}

const DNA_CACHE_TTL_MS = 30_000
let inflightDnaRequest: Promise<DnaResult | null> | null = null

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
  hasHydrated: false,
  lastFetchedAt: null,
  mirrorCharacters: null,
  isMirrorLoading: false,
  mirrorError: null,

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

  fetchResult: async (options) => {
    const { hasHydrated, lastFetchedAt, isLoading } = get()
    const shouldUseCache = !options?.force
      && hasHydrated
      && lastFetchedAt !== null
      && Date.now() - lastFetchedAt < DNA_CACHE_TTL_MS

    if (shouldUseCache) return get().result
    if (inflightDnaRequest) return inflightDnaRequest

    if (!isLoading) {
      set({ isLoading: true, error: null })
    }

    inflightDnaRequest = (async () => {
      try {
        const result = await api<DnaResult>('/dna/result')
        set({
          result,
          isLoading: false,
          hasHydrated: true,
          lastFetchedAt: Date.now(),
        })
        return result
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          set({
            result: null,
            isLoading: false,
            error: null,
            hasHydrated: true,
            lastFetchedAt: Date.now(),
          })
          return null
        }

        set({
          isLoading: false,
          error: err instanceof Error ? err.message : translateStatic('common.error'),
          hasHydrated: true,
        })
        throw err
      } finally {
        inflightDnaRequest = null
      }
    })()

    return inflightDnaRequest
  },

  fetchMirror: async () => {
    if (get().isMirrorLoading) return
    set({ isMirrorLoading: true, mirrorError: null })
    try {
      const characters = await api<CharacterMatch[]>('/dna/mirror')
      set({ mirrorCharacters: characters, isMirrorLoading: false })
    } catch (err) {
      set({
        isMirrorLoading: false,
        mirrorError: err instanceof Error ? err.message : translateStatic('common.error'),
      })
    }
  },
}))
