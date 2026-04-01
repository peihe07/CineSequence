import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock, fetchProfileMock, authState, waitlistMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  fetchProfileMock: vi.fn(() => new Promise<void>(() => {})),
  waitlistMock: vi.fn(),
  authState: {
    isAuthenticated: false,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode
    href: string
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
    className?: string
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'landing.termLine1': 'line 1',
        'landing.termLine2': 'line 2',
        'landing.termLine3': 'line 3',
        'landing.termLine4': 'headline',
        'landing.step1Title': 'Step 1',
        'landing.step1Desc': 'Desc 1',
        'landing.step2Title': 'Step 2',
        'landing.step2Desc': 'Desc 2',
        'landing.step3Title': 'Step 3',
        'landing.step3Desc': 'Desc 3',
        'landing.step4Title': 'Step 4',
        'landing.step4Desc': 'Desc 4',
        'landing.step5Title': 'Step 5',
        'landing.step5Desc': 'Desc 5',
        'landing.fileLabel': 'FILE',
        'landing.login': 'Login',
        'landing.preview': 'Preview Now',
        'landing.previewNote': 'Preview note',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => waitlistMock(...args),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: authState.isAuthenticated,
    fetchProfile: fetchProfileMock,
  }),
}))

vi.mock('@/components/auth/LoginModal', () => ({
  default: ({ open, mode }: { open: boolean; mode?: 'login' | 'register' }) =>
    open ? <div data-testid="login-modal">{mode}</div> : null,
}))

vi.mock('@/components/ui/FloatingLocaleToggle', () => ({
  default: () => null,
}))

vi.mock('@/components/ui/Footer', () => ({
  default: () => null,
}))

import LandingClient from './LandingClient'

describe('LandingClient', () => {
  beforeEach(() => {
    cleanup()
    pushMock.mockReset()
    fetchProfileMock.mockClear()
    waitlistMock.mockReset()
    authState.isAuthenticated = false
  })

  afterEach(() => {
    cleanup()
  })

  it('opens the login modal immediately without waiting for profile fetch', () => {
    render(<LandingClient />)

    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByTestId('login-modal').textContent).toBe('login')
  })

  it('submits the waitlist form from the hero', async () => {
    waitlistMock.mockResolvedValue({
      message:
        "You're on the waitlist. We're developing new features and performing maintenance. We'll email you again when access reopens.",
    })

    render(<LandingClient />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Notify me' }))

    await waitFor(() => {
      expect(waitlistMock).toHaveBeenCalledWith('/auth/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      })
    })
    expect(screen.getByText('We have saved user@example.com. We will email you again when access reopens.')).toBeTruthy()
  })

  it('renders a direct preview entry to the sequencing page', () => {
    render(<LandingClient />)

    expect(screen.getByRole('link', { name: 'Preview Now' }).getAttribute('href')).toBe('/sequencing')
    expect(screen.getByText('Preview note')).toBeTruthy()
  })
})
