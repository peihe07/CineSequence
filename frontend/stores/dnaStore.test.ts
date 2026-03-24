import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock, MockApiError } = vi.hoisted(() => {
  class HoistedApiError extends Error {
    status: number
    detail: string

    constructor(status: number, detail: string) {
      super(detail)
      this.status = status
      this.detail = detail
      this.name = 'ApiError'
    }
  }

  return {
    apiMock: vi.fn(),
    MockApiError: HoistedApiError,
  }
})

vi.mock('@/lib/api', () => ({
  ApiError: MockApiError,
  api: apiMock,
}))

import { useDnaStore } from '@/stores/dnaStore'

describe('dnaStore', () => {
  beforeEach(() => {
    apiMock.mockReset()
    useDnaStore.setState({
      result: null,
      isBuilding: false,
      isLoading: false,
      error: null,
    })
  })

  it('treats 404 dna results as an empty state', async () => {
    apiMock.mockRejectedValue(new MockApiError(404, 'DNA profile not found. Build it first.'))

    await expect(useDnaStore.getState().fetchResult()).resolves.toBeNull()

    expect(useDnaStore.getState().result).toBeNull()
    expect(useDnaStore.getState().error).toBeNull()
    expect(useDnaStore.getState().isLoading).toBe(false)
  })

  it('still surfaces non-404 dna fetch failures', async () => {
    apiMock.mockRejectedValue(new MockApiError(500, 'Server error'))

    await expect(useDnaStore.getState().fetchResult()).rejects.toThrow('Server error')

    expect(useDnaStore.getState().error).toBe('Server error')
    expect(useDnaStore.getState().isLoading).toBe(false)
  })

  it('builds dna and hydrates the current result before resolving', async () => {
    const result = {
      archetype: {
        id: 'archivist',
        name: 'Archivist',
        name_en: 'Archivist',
        icon: 'film',
        description: 'Test archetype',
      },
      tag_vector: [],
      tag_labels: {},
      genre_vector: {},
      quadrant_scores: {
        mainstream_independent: 0.4,
        rational_emotional: 0.5,
        light_dark: 0.6,
      },
      personality_reading: null,
      hidden_traits: [],
      conversation_style: null,
      ideal_movie_date: null,
      ticket_style: 'classic',
    }

    apiMock
      .mockResolvedValueOnce({ status: 'ready' })
      .mockResolvedValueOnce(result)

    await expect(useDnaStore.getState().buildDna()).resolves.toEqual(result)

    expect(apiMock).toHaveBeenNthCalledWith(1, '/dna/build', { method: 'POST' })
    expect(apiMock).toHaveBeenNthCalledWith(2, '/dna/result')
    expect(useDnaStore.getState().result).toEqual(result)
    expect(useDnaStore.getState().isBuilding).toBe(false)
  })
})
