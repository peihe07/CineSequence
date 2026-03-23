import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  replaceMock,
  sequencingState,
  fetchProgressMock,
  fetchPairMock,
  rerollPairMock,
  submitPickMock,
  skipMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  sequencingState: {
    currentPair: null as null | {
      completed: boolean
      round_number: number
      phase: number
      movie_a?: { tmdb_id: number; title_en: string; title_zh: string | null }
      movie_b?: { tmdb_id: number; title_en: string; title_zh: string | null }
    },
    progress: null as null | {
      completed: boolean
      round_number: number
      phase: number
      total_rounds: number
      seed_movie_tmdb_id: number | null
    },
    liveTags: [] as string[],
    isLoading: false,
    ambientColor: null as string | null,
    error: null as string | null,
  },
  fetchProgressMock: vi.fn(),
  fetchPairMock: vi.fn(),
  rerollPairMock: vi.fn(),
  submitPickMock: vi.fn(),
  skipMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: Object.assign(
    () => ({
      ...sequencingState,
      fetchProgress: fetchProgressMock,
      fetchPair: fetchPairMock,
      rerollPair: rerollPairMock,
      submitPick: submitPickMock,
      skip: skipMock,
    }),
    {
      getState: () => sequencingState,
    },
  ),
}))

vi.mock('@/components/sequencing/SwipePair', () => ({
  default: ({ pair, onPick }: {
    pair: {
      movie_a: { tmdb_id: number; title_en: string; title_zh: string | null }
      movie_b: { tmdb_id: number; title_en: string; title_zh: string | null }
    }
    onPick: (tmdbId: number) => void
  }) => (
    <>
      <div>SwipePair</div>
      <button type="button" onClick={() => onPick(pair.movie_a.tmdb_id)}>
        Pick {pair.movie_a.title_zh || pair.movie_a.title_en}
      </button>
      <button type="button" onClick={() => onPick(pair.movie_b.tmdb_id)}>
        Pick {pair.movie_b.title_zh || pair.movie_b.title_en}
      </button>
    </>
  ),
}))

vi.mock('@/components/sequencing/LiquidTube', () => ({
  default: () => <div>LiquidTube</div>,
}))

vi.mock('@/components/sequencing/PhaseIndicator', () => ({
  default: () => <div>PhaseIndicator</div>,
}))

vi.mock('@/components/sequencing/LiveTagCloud', () => ({
  default: () => <div>LiveTagCloud</div>,
}))

vi.mock('@/components/sequencing/SkipActions', () => ({
  default: ({ onSkip, onReroll }: { onSkip: () => void; onReroll: () => void }) => (
    <>
      <button type="button" onClick={onReroll}>RerollActions</button>
      <button type="button" onClick={onSkip}>SkipActions</button>
    </>
  ),
}))

vi.mock('@/components/sequencing/OnboardingOverlay', () => ({
  default: () => <div>OnboardingOverlay</div>,
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'common.error': 'Something went wrong',
        'error.retry': 'Retry',
      }
      return dict[key] ?? key
    },
  }),
}))

import SequencingPage from './page'

describe('SequencingPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    replaceMock.mockReset()
    fetchProgressMock.mockReset()
    fetchPairMock.mockReset()
    rerollPairMock.mockReset()
    submitPickMock.mockReset()
    skipMock.mockReset()
    sequencingState.currentPair = null
    sequencingState.progress = null
    sequencingState.liveTags = []
    sequencingState.isLoading = false
    sequencingState.ambientColor = null
    sequencingState.error = null
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a retry state when initialization fails', async () => {
    sequencingState.error = 'Failed to fetch sequencing progress'
    fetchProgressMock.mockRejectedValue(new Error('Failed to fetch sequencing progress'))

    render(<SequencingPage />)

    expect(await screen.findByText('Failed to fetch sequencing progress')).toBeTruthy()
    expect(fetchPairMock).not.toHaveBeenCalled()
  })

  it('retries initialization when retry is clicked', async () => {
    sequencingState.error = 'Failed to fetch sequencing progress'
    fetchProgressMock
      .mockRejectedValueOnce(new Error('Failed to fetch sequencing progress'))
      .mockImplementationOnce(async () => {
        sequencingState.error = null
        sequencingState.progress = {
          completed: false,
          round_number: 2,
          phase: 1,
          total_rounds: 20,
          seed_movie_tmdb_id: 10,
        }
      })
    fetchPairMock.mockImplementation(async () => {
      sequencingState.currentPair = {
        completed: false,
        round_number: 2,
        phase: 1,
        movie_a: { tmdb_id: 10, title_en: 'Inception', title_zh: null },
        movie_b: { tmdb_id: 20, title_en: 'La La Land', title_zh: null },
      }
    })

    const { rerender } = render(<SequencingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    rerender(<SequencingPage />)

    await waitFor(() => {
      expect(screen.getByText('SwipePair')).toBeTruthy()
    })
    expect(fetchProgressMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(fetchPairMock.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('submits immediately when a movie is picked', async () => {
    sequencingState.progress = {
      completed: false,
      round_number: 2,
      phase: 1,
      total_rounds: 20,
      seed_movie_tmdb_id: 10,
    }
    sequencingState.currentPair = {
      completed: false,
      round_number: 2,
      phase: 1,
      movie_a: { tmdb_id: 10, title_en: 'Inception', title_zh: null },
      movie_b: { tmdb_id: 20, title_en: 'La La Land', title_zh: '樂來越愛你' },
    }

    render(<SequencingPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Pick Inception' }))

    expect(submitPickMock).toHaveBeenCalledTimes(1)
    expect(submitPickMock).toHaveBeenCalledWith(10, 'watched', expect.any(Number))
  })

  it('still supports skipping the pair directly', async () => {
    sequencingState.progress = {
      completed: false,
      round_number: 3,
      phase: 1,
      total_rounds: 20,
      seed_movie_tmdb_id: 10,
    }
    sequencingState.currentPair = {
      completed: false,
      round_number: 3,
      phase: 1,
      movie_a: { tmdb_id: 10, title_en: 'Inception', title_zh: null },
      movie_b: { tmdb_id: 20, title_en: 'La La Land', title_zh: '樂來越愛你' },
    }

    render(<SequencingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'SkipActions' }))

    expect(skipMock).toHaveBeenCalledTimes(1)
    expect(skipMock).toHaveBeenCalledWith(expect.any(Number))
  })
})
