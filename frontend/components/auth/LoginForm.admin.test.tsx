import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  refreshMock,
  loginMock,
  fetchProfileMock,
  clearErrorMock,
  apiMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  loginMock: vi.fn(),
  fetchProfileMock: vi.fn(),
  clearErrorMock: vi.fn(),
  apiMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, detail: string) {
      super(detail)
      this.status = status
    }
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    login: loginMock,
    fetchProfile: fetchProfileMock,
    isLoading: false,
    error: null,
    clearError: clearErrorMock,
  }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) => {
      if (key === 'auth.checkEmailSent' && vars?.email) {
        return `sent:${vars.email}`
      }
      const dict: Record<string, string> = {
        'auth.invalidEmail': 'Invalid email',
        'auth.signIn': 'Sign in',
        'auth.subtitle': 'Sign in subtitle',
        'auth.emailPlaceholder': 'Enter your email',
        'auth.noAccount': 'No account?',
        'auth.sendLink': 'Continue',
        'auth.sending': 'Sending...',
        'auth.accountNotFound': 'Account not found',
        'common.error': 'Error',
      }
      return dict[key] ?? key
    },
  }),
}))

import LoginForm from './LoginForm'

describe('LoginForm admin flow', () => {
  beforeEach(() => {
    cleanup()
    pushMock.mockReset()
    refreshMock.mockReset()
    loginMock.mockReset()
    fetchProfileMock.mockReset()
    clearErrorMock.mockReset()
    apiMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the admin quick-login error when passcode auth fails', async () => {
    loginMock.mockResolvedValue({
      mode: 'admin_passcode_required',
      message: 'Admin passcode required.',
    })
    apiMock.mockRejectedValue(new Error('Invalid admin credentials.'))

    render(<LoginForm />)

    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'admin@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByLabelText('Admin Passcode')

    fireEvent.change(screen.getByLabelText('Admin Passcode'), {
      target: { value: 'wrong-passcode' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid admin credentials.')).toBeTruthy()
    })
  })
})
