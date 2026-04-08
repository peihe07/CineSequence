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
    locale: 'en',
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    register: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
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

  it('renders the registration form', () => {
    render(<RegisterPage />)

    expect(screen.getByText('register.title')).toBeTruthy()
    expect(screen.getByText('register.subtitle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'register.submit' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'auth.signIn' }).getAttribute('href')).toBe('/login')
    expect(screen.queryByText('Registration is temporarily paused')).toBeNull()
  })
})
