import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replaceMock,
  fetchProgressMock,
  extendSequencingMock,
  buildDnaMock,
  progressState,
  playSoundMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  fetchProgressMock: vi.fn(),
  extendSequencingMock: vi.fn(),
  buildDnaMock: vi.fn(),
  playSoundMock: vi.fn(),
  progressState: {
    progress: {
      extension_batches: 1,
      max_extension_batches: 3,
      can_extend: true,
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
    extendSequencing: extendSequencingMock,
  }),
}))

vi.mock('@/stores/dnaStore', () => ({
  useDnaStore: () => ({
    buildDna: buildDnaMock,
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
        'complete.extensions': 'Extensions',
        'complete.viewDna': 'View DNA',
        'complete.extend': 'Extend',
        'complete.maxReached': 'Max reached',
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
    extendSequencingMock.mockReset()
    buildDnaMock.mockReset()
    playSoundMock.mockReset()
    progressState.progress = {
      extension_batches: 1,
      max_extension_batches: 3,
      can_extend: true,
      total_rounds: 25,
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('renders completion stats and routes to dna', async () => {
    buildDnaMock.mockResolvedValue({ archetype: { id: 'archivist' } })

    render(<SequencingCompletePage />)

    expect(screen.getByRole('heading', { name: 'Sequencing Complete' })).toBeTruthy()
    expect(screen.getByText('Complete 25')).toBeTruthy()
    expect(screen.getByText('RUN CLOSED // ANALYSIS READY')).toBeTruthy()
    expect(screen.getByText('25')).toBeTruthy()
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(fetchProgressMock).toHaveBeenCalled()
    expect(playSoundMock).toHaveBeenCalledWith('complete')
    expect(buildDnaMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith('/dna')
    })
  })

  it('shows the user on the completion page when building the report fails', async () => {
    buildDnaMock.mockResolvedValue(null)

    render(<SequencingCompletePage />)

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
    })

    expect(replaceMock).not.toHaveBeenCalledWith('/dna')
    expect(screen.getByRole('button', { name: 'View DNA' })).toBeTruthy()
  })

  it('allows retrying dna generation manually after a failed build', async () => {
    buildDnaMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ archetype: { id: 'archivist' } })

    render(<SequencingCompletePage />)

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(buildDnaMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'View DNA' }))

    await waitFor(() => {
      expect(buildDnaMock).toHaveBeenCalledTimes(2)
      expect(replaceMock).toHaveBeenCalledWith('/dna')
    })
  })

  it('extends sequencing and routes back into the sequencing flow', async () => {
    extendSequencingMock.mockResolvedValue(undefined)

    render(<SequencingCompletePage />)

    fireEvent.click(screen.getByRole('button', { name: /Extend/i }))

    await waitFor(() => {
      expect(extendSequencingMock).toHaveBeenCalled()
      expect(replaceMock).toHaveBeenCalledWith('/sequencing')
    })
  })

  it('does not route back into sequencing when the extension request fails', async () => {
    buildDnaMock.mockResolvedValue(null)
    extendSequencingMock.mockRejectedValue(new Error('Extend failed'))

    render(<SequencingCompletePage />)

    expect(await screen.findByRole('button', { name: /Extend/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Extend/i }))

    await waitFor(() => {
      expect(extendSequencingMock).toHaveBeenCalled()
    })
    expect(replaceMock).not.toHaveBeenCalledWith('/sequencing')
  })
})
