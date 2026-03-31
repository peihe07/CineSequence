import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SkipActions from './SkipActions'

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'seq.reroll': 'Swap this pair',
        'seq.skipPair': 'Skip this pair',
        'seq.moreOptions': 'More options',
        'seq.dislikeBoth': 'Dislike both',
        'seq.rerollHint': 'Use this when you want a different comparison, not to signal dislike.',
        'seq.skipHint': 'Use this when you cannot judge either movie in this round.',
        'seq.moreOptionsHint': 'Open less common actions without crowding the main flow.',
        'seq.dislikeBothHint': 'Use this when you can judge both movies and reject both of them.',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/lib/sound', () => ({
  soundManager: {
    play: vi.fn(),
  },
}))

describe('SkipActions', () => {
  afterEach(() => {
    cleanup()
  })

  it('calls reroll when reroll button is clicked', () => {
    const onReroll = vi.fn()
    const onSkip = vi.fn()

    render(<SkipActions onSkip={onSkip} onReroll={onReroll} onDislikeBoth={vi.fn()} onSeenOneSide={vi.fn()} disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Swap this pair' }))

    expect(onReroll).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('renders guidance copy for reroll and skip', () => {
    render(<SkipActions onSkip={vi.fn()} onReroll={vi.fn()} onDislikeBoth={vi.fn()} onSeenOneSide={vi.fn()} disabled={false} />)

    expect(screen.getByText('Use this when you want a different comparison, not to signal dislike.')).toBeTruthy()
    expect(screen.getByText('Use this when you cannot judge either movie in this round.')).toBeTruthy()
    expect(screen.getByText('Open less common actions without crowding the main flow.')).toBeTruthy()
  })

  it('calls dislikeBoth when the new action is clicked', () => {
    const onDislikeBoth = vi.fn()

    render(
      <SkipActions
        onSkip={vi.fn()}
        onReroll={vi.fn()}
        onDislikeBoth={onDislikeBoth}
        onSeenOneSide={vi.fn()}
        disabled={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dislike both' }))

    expect(onDislikeBoth).toHaveBeenCalledTimes(1)
  })
})
