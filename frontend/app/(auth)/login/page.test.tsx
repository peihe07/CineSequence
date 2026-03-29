import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replaceMock,
  fetchProfileMock,
  authState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  fetchProfileMock: vi.fn().mockResolvedValue(undefined),
  authState: {
    isAuthenticated: false,
    isLoading: false,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({
    get: () => null,
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    fetchProfile: fetchProfileMock,
  }),
}))

vi.mock('@/components/auth/LoginForm', () => ({
  default: () => <div>Login form</div>,
}))

import LoginPage from './page'

describe('LoginPage', () => {
  beforeEach(() => {
    cleanup()
    replaceMock.mockReset()
    fetchProfileMock.mockReset()
    fetchProfileMock.mockResolvedValue(undefined)
    authState.isAuthenticated = false
    authState.isLoading = false
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the standard login form by default', async () => {
    render(<LoginPage />)

    expect(await screen.findByText('Login form')).toBeTruthy()
  })
})
