import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'zh',
  }),
}))

import LiveTagCloud from './LiveTagCloud'

describe('LiveTagCloud', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders localized chinese labels for known tags', () => {
    render(<LiveTagCloud tags={['mindfuck', 'darkTone']} />)

    expect(screen.getByText('燒腦')).toBeTruthy()
    expect(screen.getByText('黑暗')).toBeTruthy()
    expect(screen.queryByText('mindfuck')).toBeNull()
    expect(screen.queryByText('darkTone')).toBeNull()
  })
})
