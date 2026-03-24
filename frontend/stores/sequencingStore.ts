import { create } from 'zustand'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'

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
  can_extend: boolean
  extension_batches: number
  max_extension_batches: number
  session_version: number
  is_extending: boolean
}

interface ExtendResponse {
  total_rounds: number
  extension_batches: number
  max_extension_batches: number
}

interface SequencingState {
  currentPair: Pair | null
  progress: Progress | null
  liveTags: string[]
  rerollExcludedTmdbIds: number[]
  isLoading: boolean
  error: string | null
  ambientColor: string | null

  fetchPair: () => Promise<Pair>
  rerollPair: () => Promise<void>
  fetchProgress: () => Promise<Progress>
  submitPick: (tmdbId: number, pickMode?: 'watched' | 'attracted', responseTimeMs?: number) => Promise<void>
  skip: (responseTimeMs?: number) => Promise<void>
  setSeedMovie: (tmdbId: number) => Promise<void>
  extendSequencing: () => Promise<void>
  startRetest: () => Promise<void>
  setAmbientColor: (color: string | null) => void
  addLiveTag: (tag: string) => void
}

export const useSequencingStore = create<SequencingState>((set, get) => ({
  currentPair: null,
  progress: null,
  liveTags: [],
  rerollExcludedTmdbIds: [],
  isLoading: false,
  error: null,
  ambientColor: null,

  fetchPair: async () => {
    set({ currentPair: null, rerollExcludedTmdbIds: [], isLoading: true, error: null })
    try {
      const pair = await api<Pair>('/sequencing/pair')
      set({ currentPair: pair, isLoading: false })
      return pair
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : translateStatic('common.error') })
      throw err
    }
  },

  rerollPair: async () => {
    const { currentPair, rerollExcludedTmdbIds } = get()
    if (!currentPair) return

    const nextExcludedIds = Array.from(new Set([
      ...rerollExcludedTmdbIds,
      currentPair.movie_a.tmdb_id,
      currentPair.movie_b.tmdb_id,
    ]))

    set({ currentPair: null, isLoading: true, error: null, rerollExcludedTmdbIds: nextExcludedIds })
    try {
      const pair = await api<Pair>('/sequencing/reroll', {
        method: 'POST',
        body: JSON.stringify({ exclude_tmdb_ids: nextExcludedIds }),
      })
      set({ currentPair: pair, isLoading: false })
    } catch (err) {
      set({
        currentPair,
        isLoading: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
      throw err
    }
  },

  fetchProgress: async () => {
    try {
      const progress = await api<Progress>('/sequencing/progress')
      set({ progress, error: null })
      return progress
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
      throw err
    }
  },

  submitPick: async (tmdbId, pickMode = 'watched', responseTimeMs) => {
    const { currentPair, liveTags, rerollExcludedTmdbIds } = get()

    if (currentPair?.test_dimension) {
      set((state) => ({
        liveTags: [...state.liveTags, currentPair.test_dimension!],
      }))
    }

    set({ currentPair: null, rerollExcludedTmdbIds: [], isLoading: true })
    try {
      const progress = await api<Progress>('/sequencing/pick', {
        method: 'POST',
        body: JSON.stringify({
          chosen_tmdb_id: tmdbId,
          pick_mode: pickMode,
          movie_a_tmdb_id: currentPair?.movie_a.tmdb_id ?? null,
          movie_b_tmdb_id: currentPair?.movie_b.tmdb_id ?? null,
          response_time_ms: responseTimeMs,
          test_dimension: currentPair?.test_dimension ?? null,
        }),
      })
      set({ progress, isLoading: false, ambientColor: null })

      if (!progress.completed) {
        get().fetchPair()
      }
    } catch (err) {
      set({
        currentPair,
        liveTags,
        rerollExcludedTmdbIds,
        isLoading: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
    }
  },

  skip: async (responseTimeMs) => {
    const { currentPair, rerollExcludedTmdbIds } = get()
    set({ currentPair: null, rerollExcludedTmdbIds: [], isLoading: true })
    try {
      const progress = await api<Progress>('/sequencing/skip', {
        method: 'POST',
        body: JSON.stringify({
          movie_a_tmdb_id: currentPair?.movie_a.tmdb_id ?? null,
          movie_b_tmdb_id: currentPair?.movie_b.tmdb_id ?? null,
          response_time_ms: responseTimeMs,
          test_dimension: currentPair?.test_dimension ?? null,
        }),
      })
      set({ progress, isLoading: false, ambientColor: null })

      if (!progress.completed) {
        get().fetchPair()
      }
    } catch (err) {
      set({
        currentPair,
        rerollExcludedTmdbIds,
        isLoading: false,
        error: err instanceof Error ? err.message : translateStatic('common.error'),
      })
    }
  },

  setSeedMovie: async (tmdbId) => {
    set({ isLoading: true, error: null })
    try {
      await api('/sequencing/seed-movie', {
        method: 'POST',
        body: JSON.stringify({ tmdb_id: tmdbId }),
      })
      set({ isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : translateStatic('common.error') })
      throw err
    }
  },

  extendSequencing: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api<ExtendResponse>('/sequencing/extend', { method: 'POST' })
      set((state) => ({
        currentPair: null,
        isLoading: false,
        progress: state.progress
          ? {
              ...state.progress,
              total_rounds: res.total_rounds,
              extension_batches: res.extension_batches,
              max_extension_batches: res.max_extension_batches,
              completed: false,
              can_extend: false,
              is_extending: true,
            }
          : null,
      }))
      return
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : translateStatic('common.error') })
      throw err
    }
  },

  startRetest: async () => {
    set({ isLoading: true, error: null })
    try {
      await api('/sequencing/retest', { method: 'POST' })
      set({
        isLoading: false,
        currentPair: null,
        progress: null,
        liveTags: [],
        rerollExcludedTmdbIds: [],
      })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : translateStatic('common.error') })
    }
  },

  setAmbientColor: (color) => set({ ambientColor: color }),

  addLiveTag: (tag) => set((state) => ({
    liveTags: state.liveTags.includes(tag) ? state.liveTags : [...state.liveTags, tag],
  })),
}))
