import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  fetchResultMock,
  buildDnaMock,
  dnaState,
  MockApiError,
} = vi.hoisted(() => {
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
    pushMock: vi.fn(),
    fetchResultMock: vi.fn(),
    buildDnaMock: vi.fn(),
    dnaState: {
      result: null as null | {
        archetype: { id: string }
        genre_vector: Record<string, number>
        quadrant_scores: Record<string, number>
        tag_labels: Record<string, number>
        personality_reading: string | null
        hidden_traits: string[]
        conversation_style: string | null
        ideal_movie_date: string | null
      },
      isBuilding: false,
      isLoading: false,
      error: null as string | null,
    },
    MockApiError: HoistedApiError,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/stores/dnaStore', () => ({
  useDnaStore: () => ({
    ...dnaState,
    fetchResult: fetchResultMock,
    buildDna: buildDnaMock,
  }),
}))

vi.mock('@/lib/api', () => ({
  ApiError: MockApiError,
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'dna.analyzing': 'Analyzing DNA...',
        'dna.retry': 'Retry',
        'dna.title': 'Your Cine DNA',
        'dna.findMatches': 'Find matches',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/components/guards/FlowGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/dna/ArchetypeCard', () => ({
  default: () => <div>ArchetypeCard</div>,
}))

vi.mock('@/components/dna/StarNebula', () => ({
  default: () => <div>StarNebula</div>,
}))

vi.mock('@/components/dna/TagCloud', () => ({
  default: () => <div>TagCloud</div>,
}))

vi.mock('@/components/dna/RadarChart', () => ({
  default: () => <div>RadarChart</div>,
}))

vi.mock('@/components/dna/AIReading', () => ({
  default: () => <div>AIReading</div>,
}))

import DnaResultPage from './page'

describe('DnaResultPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    fetchResultMock.mockReset()
    buildDnaMock.mockReset()
    dnaState.result = null
    dnaState.isBuilding = false
    dnaState.isLoading = false
    dnaState.error = null
  })

  afterEach(() => {
    cleanup()
  })

  it('builds DNA when fetching the current result returns 404', async () => {
    fetchResultMock.mockRejectedValue(new MockApiError(404, 'Not found'))

    render(<DnaResultPage />)

    await waitFor(() => {
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
    })
  })

  it('does not build DNA for non-404 failures and shows the error', async () => {
    dnaState.error = 'Server error'
    fetchResultMock.mockRejectedValue(new MockApiError(500, 'Server error'))

    render(<DnaResultPage />)

    expect(await screen.findByText('Server error')).toBeTruthy()
    expect(buildDnaMock).not.toHaveBeenCalled()
  })
})
