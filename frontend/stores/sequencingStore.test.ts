import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

import { useSequencingStore } from '@/stores/sequencingStore'

const pairFixture = {
  round_number: 6,
  phase: 2,
  movie_a: {
    tmdb_id: 3101,
    title_en: 'Movie A',
    title_zh: '電影 A',
    poster_url: null,
    year: 2020,
    genres: ['Drama'],
    overview: null,
  },
  movie_b: {
    tmdb_id: 3102,
    title_en: 'Movie B',
    title_zh: '電影 B',
    poster_url: null,
    year: 2021,
    genres: ['Thriller'],
    overview: null,
  },
  test_dimension: 'slowburn',
  completed: false,
}

describe('sequencingStore', () => {
  beforeEach(() => {
    apiMock.mockReset()
    useSequencingStore.setState({
      currentPair: structuredClone(pairFixture),
      progress: null,
      liveTags: [],
      rerollExcludedTmdbIds: [101, 202],
      isLoading: false,
      error: null,
      ambientColor: '#123456',
    })
  })

  it('restores the current pair when submitPick fails', async () => {
    apiMock.mockRejectedValue(new Error('Request failed'))

    await useSequencingStore.getState().submitPick(3101, 'watched', 1500)

    expect(useSequencingStore.getState().currentPair).toEqual(pairFixture)
    expect(useSequencingStore.getState().liveTags).toEqual([])
    expect(useSequencingStore.getState().rerollExcludedTmdbIds).toEqual([101, 202])
    expect(useSequencingStore.getState().error).toBe('Request failed')
    expect(useSequencingStore.getState().isLoading).toBe(false)
  })

  it('restores the current pair when skip fails', async () => {
    apiMock.mockRejectedValue(new Error('Skip failed'))

    await useSequencingStore.getState().skip(900)

    expect(useSequencingStore.getState().currentPair).toEqual(pairFixture)
    expect(useSequencingStore.getState().rerollExcludedTmdbIds).toEqual([101, 202])
    expect(useSequencingStore.getState().error).toBe('Skip failed')
    expect(useSequencingStore.getState().isLoading).toBe(false)
  })
})
