import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replaceMock,
  fetchProgressMock,
  buildDnaMock,
  fetchResultMock,
  progressState,
  playSoundMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  fetchProgressMock: vi.fn(),
  buildDnaMock: vi.fn(),
  fetchResultMock: vi.fn(),
  playSoundMock: vi.fn(),
  progressState: {
    progress: {
      total_rounds: 25,
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: () => ({
    ...progressState,
    fetchProgress: fetchProgressMock,
  }),
}))

vi.mock('@/stores/dnaStore', () => ({
  useDnaStore: () => ({
    buildDna: buildDnaMock,
    fetchResult: fetchResultMock,
  }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'complete.subtitle') {
        return `Complete ${vars?.total}`
      }
      if (key === 'complete.extendHint') {
        return `Remaining ${vars?.remaining}`
      }
      const dict: Record<string, string> = {
        'complete.title': 'Sequencing Complete',
        'complete.fileLabel': 'FILE 04',
        'complete.eyebrow': '[ SEQUENCE_COMPLETE ]',
        'complete.heroMeta': 'RUN CLOSED // ANALYSIS READY',
        'complete.rounds': 'Rounds',
        'complete.viewDna': 'View DNA',
        'dna.analyzing': 'Analyzing DNA...',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/lib/sound', () => ({
  soundManager: {
    play: playSoundMock,
  },
}))

import SequencingCompletePage from './page'

describe('SequencingCompletePage', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    fetchProgressMock.mockReset()
    buildDnaMock.mockReset()
    fetchResultMock.mockReset()
    playSoundMock.mockReset()
    progressState.progress = {
      total_rounds: 25,
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('renders completion stats and routes to dna', async () => {
    fetchResultMock.mockResolvedValue({ archetype: { id: 'archivist' } })

    render(<SequencingCompletePage />)

    expect(screen.getByRole('heading', { name: 'Sequencing Complete' })).toBeTruthy()
    expect(screen.getByText('Complete 25')).toBeTruthy()
    expect(screen.getByText('RUN CLOSED // ANALYSIS READY')).toBeTruthy()
    expect(screen.getByText('25')).toBeTruthy()
    expect(fetchProgressMock).toHaveBeenCalled()
    expect(playSoundMock).toHaveBeenCalledWith('complete')
    expect(buildDnaMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(fetchResultMock).toHaveBeenCalledTimes(1)
      expect(buildDnaMock).not.toHaveBeenCalled()
      expect(replaceMock).toHaveBeenCalledWith('/dna')
    })
  })

  it('builds dna when no stored result exists', async () => {
    fetchResultMock.mockResolvedValue(null)
    buildDnaMock.mockResolvedValue({ archetype: { id: 'archivist' } })

    render(<SequencingCompletePage />)

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(fetchResultMock).toHaveBeenCalledTimes(1)
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith('/dna')
    })
  })

  it('shows the user on the completion page when building the report fails', async () => {
    fetchResultMock.mockResolvedValue(null)
    buildDnaMock.mockResolvedValue(null)

    render(<SequencingCompletePage />)

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(fetchResultMock).toHaveBeenCalledTimes(1)
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
    })

    expect(replaceMock).not.toHaveBeenCalledWith('/dna')
    expect(screen.getByRole('button', { name: 'View DNA' })).toBeTruthy()
  })

  it('allows retrying dna generation manually after a failed build', async () => {
    fetchResultMock.mockResolvedValue(null)
    buildDnaMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ archetype: { id: 'archivist' } })

    render(<SequencingCompletePage />)

    const viewDnaButton = screen.getByRole('button', { name: 'View DNA' })

    fireEvent.click(viewDnaButton)

    await waitFor(() => {
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(viewDnaButton.hasAttribute('disabled')).toBe(false)
    })

    fireEvent.click(viewDnaButton)

    await waitFor(() => {
      expect(fetchResultMock).toHaveBeenCalledTimes(2)
      expect(buildDnaMock).toHaveBeenCalledTimes(2)
      expect(replaceMock).toHaveBeenCalledWith('/dna')
    })
  })

  it('shows only the dna action on the completion page', () => {
    render(<SequencingCompletePage />)

    expect(screen.getByRole('button', { name: 'View DNA' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Extend/i })).toBeNull()
  })
})
