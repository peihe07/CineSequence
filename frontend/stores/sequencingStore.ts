import { create } from 'zustand'
import { api } from '@/lib/api'

interface MovieInfo {
  tmdb_id: number
  title_en: string
  title_zh: string | null
  poster_url: string | null
  year: number | null
  genres: string[]
  overview: string | null
}

interface Pair {
  round_number: number
  phase: number
  movie_a: MovieInfo
  movie_b: MovieInfo
  test_dimension: string | null
  completed: boolean
}

interface Progress {
  round_number: number
  phase: number
  total_rounds: number
  completed: boolean
  seed_movie_tmdb_id: number | null
}

interface SequencingState {
  currentPair: Pair | null
  progress: Progress | null
  liveTags: string[]
  isLoading: boolean
  error: string | null
  // Dynamic background color extracted from hovered movie poster
  ambientColor: string | null

  fetchPair: () => Promise<void>
  fetchProgress: () => Promise<void>
  submitPick: (tmdbId: number, pickMode: 'watched' | 'attracted', responseTimeMs?: number) => Promise<void>
  skip: (responseTimeMs?: number) => Promise<void>
  setSeedMovie: (tmdbId: number) => Promise<void>
  setAmbientColor: (color: string | null) => void
  addLiveTag: (tag: string) => void
}

export const useSequencingStore = create<SequencingState>((set, get) => ({
  currentPair: null,
  progress: null,
  liveTags: [],
  isLoading: false,
  error: null,
  ambientColor: null,

  fetchPair: async () => {
    set({ isLoading: true, error: null })
    try {
      const pair = await api<Pair>('/sequencing/pair')
      set({ currentPair: pair, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch pair' })
    }
  },

  fetchProgress: async () => {
    try {
      const progress = await api<Progress>('/sequencing/progress')
      set({ progress })
    } catch {
      // Silent fail for progress
    }
  },

  submitPick: async (tmdbId, pickMode, responseTimeMs) => {
    const { currentPair } = get()

    // Optimistic: add test dimension as live tag
    if (currentPair?.test_dimension) {
      set((state) => ({
        liveTags: [...state.liveTags, currentPair.test_dimension!],
      }))
    }

    set({ isLoading: true })
    try {
      const progress = await api<Progress>('/sequencing/pick', {
        method: 'POST',
        body: JSON.stringify({
          chosen_tmdb_id: tmdbId,
          pick_mode: pickMode,
          response_time_ms: responseTimeMs,
        }),
      })
      set({ progress, isLoading: false, ambientColor: null })

      // Auto-fetch next pair if not completed
      if (!progress.completed) {
        get().fetchPair()
      }
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to submit pick' })
    }
  },

  skip: async (responseTimeMs) => {
    set({ isLoading: true })
    try {
      const progress = await api<Progress>('/sequencing/skip', {
        method: 'POST',
        body: JSON.stringify({ response_time_ms: responseTimeMs }),
      })
      set({ progress, isLoading: false, ambientColor: null })

      if (!progress.completed) {
        get().fetchPair()
      }
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to skip' })
    }
  },

  setSeedMovie: async (tmdbId) => {
    set({ isLoading: true })
    try {
      await api('/sequencing/seed-movie', {
        method: 'POST',
        body: JSON.stringify({ tmdb_id: tmdbId }),
      })
      set({ isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to set seed movie' })
    }
  },

  setAmbientColor: (color) => set({ ambientColor: color }),

  addLiveTag: (tag) => set((state) => ({
    liveTags: state.liveTags.includes(tag) ? state.liveTags : [...state.liveTags, tag],
  })),
}))
