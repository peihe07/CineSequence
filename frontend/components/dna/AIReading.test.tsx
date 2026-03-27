import { act, cleanup, render, screen } from '@testing-library/react'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: (() => {
    const MotionDiv = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>((props, ref) => (
      <div ref={ref} {...props} />
    ))
    MotionDiv.displayName = 'MotionDiv'
    return { div: MotionDiv }
  })(),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'dna.reading': 'AI Reading',
        'dna.traits': 'Hidden Traits',
        'dna.style': 'Conversation Style',
        'dna.idealDate': 'Ideal Movie Date',
      }
      return dict[key] ?? key
    },
  }),
}))

import AIReading from './AIReading'

describe('AIReading', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    window.matchMedia = originalMatchMedia
  })

  it('shows the full reading immediately on coarse-pointer devices', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: none) and (pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <AIReading
        personalityReading="You trust slow-burn stories."
        hiddenTraits={['Observant']}
        conversationStyle="Quiet, specific, and curious."
        idealMovieDate="Late-night repertory screenings."
      />,
    )

    expect(screen.getByText('You trust slow-burn stories.')).toBeTruthy()
    expect(screen.getByText('Hidden Traits')).toBeTruthy()
    expect(screen.getByText('Conversation Style')).toBeTruthy()
    expect(screen.getByText('Ideal Movie Date')).toBeTruthy()
  })

  it('reveals extras after the typewriter animation completes on desktop', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <AIReading
        personalityReading="abc"
        hiddenTraits={['Observant']}
        conversationStyle="Quiet"
        idealMovieDate="Rainy matinee"
      />,
    )

    expect(screen.queryByText('Hidden Traits')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.getByText('Hidden Traits')).toBeTruthy()
  })
})
