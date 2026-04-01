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
        'dna.reading': 'Reading Notes',
        'dna.signal': 'Primary signals',
        'dna.traits': 'Profile keywords',
        'dna.style': 'Interaction note',
        'dna.idealDate': 'Ideal movie date',
        'dna.showMore': 'Read more',
        'dna.showLess': 'Show less',
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
        topTags={['mindfuck', 'slowburn', 'dialogue']}
        personalityReading="You trust slow-burn stories."
        hiddenTraits={['Observant']}
        conversationStyle="Quiet, specific, and curious."
        idealMovieDate="Late-night repertory screenings."
      />,
    )

    expect(screen.getByText('You trust slow-burn stories.')).toBeTruthy()
    expect(screen.getByText('Primary signals')).toBeTruthy()
    expect(screen.getByText('Profile keywords')).toBeTruthy()
    expect(screen.getByText('Interaction note')).toBeTruthy()
    expect(screen.getByText('Ideal movie date')).toBeTruthy()
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
        topTags={['mindfuck', 'slowburn', 'dialogue']}
        personalityReading="abc"
        hiddenTraits={['Observant']}
        conversationStyle="Quiet"
        idealMovieDate="Rainy matinee"
      />,
    )

    expect(screen.queryByText('Profile keywords')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.getByText('Profile keywords')).toBeTruthy()
  })

  it('shows a preview first and expands on demand', () => {
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

    const longText = 'a'.repeat(140)

    render(
      <AIReading
        topTags={['mindfuck', 'slowburn', 'dialogue']}
        personalityReading={longText}
        hiddenTraits={[]}
        conversationStyle={null}
        idealMovieDate={null}
      />,
    )

    expect(screen.getByText(/…$/)).toBeTruthy()
    act(() => {
      screen.getByRole('button', { name: 'Read more' }).click()
    })
    expect(screen.getByText(longText)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy()
  })
})
