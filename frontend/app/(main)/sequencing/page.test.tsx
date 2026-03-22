import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  sequencingState,
  fetchProgressMock,
  fetchPairMock,
  submitPickMock,
  skipMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  sequencingState: {
    currentPair: null as null | { completed: boolean; round_number: number; phase: number },
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
  submitPickMock: vi.fn(),
  skipMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: Object.assign(
    () => ({
      ...sequencingState,
      fetchProgress: fetchProgressMock,
      fetchPair: fetchPairMock,
      submitPick: submitPickMock,
      skip: skipMock,
    }),
    {
      getState: () => sequencingState,
    },
  ),
}))

vi.mock('@/components/sequencing/SwipePair', () => ({
  default: () => <div>SwipePair</div>,
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
  default: ({ onSkip }: { onSkip: () => void }) => (
    <button type="button" onClick={onSkip}>SkipActions</button>
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
    fetchProgressMock.mockReset()
    fetchPairMock.mockReset()
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
})
