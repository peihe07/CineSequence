import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  fetchResultMock,
  buildDnaMock,
  autoAssignMock,
  fetchProgressMock,
  extendSequencingMock,
  dnaState,
  sequencingState,
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
    autoAssignMock: vi.fn(),
    fetchProgressMock: vi.fn(),
    extendSequencingMock: vi.fn(),
    dnaState: {
      result: null as null | {
        archetype: { id: string }
        genre_vector: Record<string, number>
        quadrant_scores: Record<string, number>
        tag_labels: Record<string, number>
        top_tags: string[]
        supporting_signals: Array<Record<string, unknown>>
        avoided_signals: Array<Record<string, unknown>>
        mixed_signals: Array<Record<string, unknown>>
        interaction_diagnostics: {
          explicit_pick_count: number
          skip_count: number
          dislike_both_count: number
        }
        personality_reading: string | null
        hidden_traits: string[]
        conversation_style: string | null
        ideal_movie_date: string | null
        can_extend?: boolean
      },
      isBuilding: false,
      isLoading: false,
      error: null as string | null,
    },
    sequencingState: {
      progress: null as null | {
        can_extend: boolean
      },
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

vi.mock('@/stores/groupStore', () => ({
  useGroupStore: () => ({
    autoAssign: autoAssignMock,
  }),
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: () => ({
    ...sequencingState,
    fetchProgress: fetchProgressMock,
    extendSequencing: extendSequencingMock,
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
        'dna.deck': 'DNA deck copy',
        'dna.diagnosticsLabel': 'Interaction summary',
        'dna.diagnosticsPicks': 'Explicit picks made',
        'dna.diagnosticsSkips': 'Rounds skipped',
        'dna.diagnosticsDislikes': 'Double rejections',
        'dna.findMatches': 'Find matches',
        'dna.enterTheaters': 'Open theaters',
        'complete.extend': 'Extend analysis (+3 rounds)',
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

vi.mock('@/components/dna/AtmosphereCanvas', () => ({
  default: () => <div>AtmosphereCanvas</div>,
}))

import DnaResultPage from './page'

describe('DnaResultPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    fetchResultMock.mockReset()
    buildDnaMock.mockReset()
    autoAssignMock.mockReset()
    fetchProgressMock.mockReset()
    extendSequencingMock.mockReset()
    fetchResultMock.mockResolvedValue(null)
    buildDnaMock.mockResolvedValue(null)
    autoAssignMock.mockResolvedValue(undefined)
    fetchProgressMock.mockResolvedValue(null)
    extendSequencingMock.mockResolvedValue(undefined)
    dnaState.result = null
    dnaState.isBuilding = false
    dnaState.isLoading = false
    dnaState.error = null
    sequencingState.progress = null
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

  it('shows extend action on dna results when sequencing can be extended', async () => {
    dnaState.result = {
      archetype: { id: 'archivist' },
      genre_vector: {},
      quadrant_scores: {},
      tag_labels: {},
      top_tags: [],
      supporting_signals: [],
      avoided_signals: [],
      mixed_signals: [],
      interaction_diagnostics: { explicit_pick_count: 24, skip_count: 2, dislike_both_count: 1 },
      personality_reading: null,
      hidden_traits: [],
      conversation_style: null,
      ideal_movie_date: null,
      can_extend: true,
    }

    render(<DnaResultPage />)

    expect(await screen.findByRole('button', { name: 'Extend analysis (+3 rounds)' })).toBeTruthy()
    expect(fetchProgressMock).toHaveBeenCalledTimes(1)
  })

  it('extends sequencing from the dna results page and routes back into sequencing', async () => {
    dnaState.result = {
      archetype: { id: 'archivist' },
      genre_vector: {},
      quadrant_scores: {},
      tag_labels: {},
      top_tags: [],
      supporting_signals: [],
      avoided_signals: [],
      mixed_signals: [],
      interaction_diagnostics: { explicit_pick_count: 24, skip_count: 2, dislike_both_count: 1 },
      personality_reading: null,
      hidden_traits: [],
      conversation_style: null,
      ideal_movie_date: null,
      can_extend: true,
    }
    extendSequencingMock.mockResolvedValue(undefined)

    render(<DnaResultPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Extend analysis (+3 rounds)' }))

    await waitFor(() => {
      expect(extendSequencingMock).toHaveBeenCalledTimes(1)
      expect(pushMock).toHaveBeenCalledWith('/sequencing')
    })
  })

  it('routes to theaters from the dna results page CTA', async () => {
    dnaState.result = {
      archetype: { id: 'archivist' },
      genre_vector: {},
      quadrant_scores: {},
      tag_labels: {},
      top_tags: [],
      supporting_signals: [],
      avoided_signals: [],
      mixed_signals: [],
      interaction_diagnostics: { explicit_pick_count: 24, skip_count: 2, dislike_both_count: 1 },
      personality_reading: null,
      hidden_traits: [],
      conversation_style: null,
      ideal_movie_date: null,
      can_extend: false,
    }

    render(<DnaResultPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Open theaters' }))

    await waitFor(() => {
      expect(autoAssignMock).toHaveBeenCalledTimes(1)
      expect(pushMock).toHaveBeenCalledWith('/theaters')
    })
  })

  it('shows interaction diagnostics on the dna result page', async () => {
    dnaState.result = {
      archetype: { id: 'archivist' },
      genre_vector: {},
      quadrant_scores: {},
      tag_labels: {},
      top_tags: [],
      supporting_signals: [],
      avoided_signals: [],
      mixed_signals: [],
      interaction_diagnostics: { explicit_pick_count: 24, skip_count: 3, dislike_both_count: 2 },
      personality_reading: null,
      hidden_traits: [],
      conversation_style: null,
      ideal_movie_date: null,
      can_extend: false,
    }

    render(<DnaResultPage />)

    expect(await screen.findByText('Interaction summary')).toBeTruthy()
    expect(screen.getByText('Explicit picks made')).toBeTruthy()
    expect(screen.getByText('Rounds skipped')).toBeTruthy()
    expect(screen.getByText('Double rejections')).toBeTruthy()
  })
})
