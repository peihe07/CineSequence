import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'waitlist.closedTitle': 'Registration is temporarily paused',
        'waitlist.closedBody': 'We are developing new features and performing maintenance.',
        'waitlist.closedNotify': 'Once the system reopens, we will send another email notification.',
        'waitlist.closedBackHome': 'Back to home',
      }
      return dict[key] ?? key
    },
  }),
}))

import RegisterPage from './page'

describe('RegisterPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the waitlist maintenance message instead of the registration form', async () => {
    render(<RegisterPage />)

    expect(await screen.findByText('Registration is temporarily paused')).toBeTruthy()
    expect(screen.getByText('We are developing new features and performing maintenance.')).toBeTruthy()
    expect(screen.getByText('Once the system reopens, we will send another email notification.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/')
    expect(screen.queryByText('register.title')).toBeNull()
  })
})
