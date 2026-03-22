import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SkipActions from './SkipActions'

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

    render(<SkipActions onSkip={onSkip} onReroll={onReroll} disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Swap this pair' }))

    expect(onReroll).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()
  })
})
