import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replaceMock,
  fetchProfileMock,
  authState,
  searchParamsState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  fetchProfileMock: vi.fn().mockResolvedValue(undefined),
  authState: {
    isAuthenticated: false,
    isLoading: false,
  },
  searchParamsState: {
    next: null as string | null,
    admin: null as string | null,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'next') return searchParamsState.next
      if (key === 'admin') return searchParamsState.admin
      return null
    },
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

vi.mock('@/components/auth/AdminQuickLoginForm', () => ({
  default: () => <div>Admin quick login form</div>,
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
    searchParamsState.next = null
    searchParamsState.admin = null
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the standard login form by default', async () => {
    render(<LoginPage />)

    expect(await screen.findByText('Login form')).toBeTruthy()
  })

  it('renders the admin quick login form when admin mode is requested', async () => {
    searchParamsState.admin = '1'

    render(<LoginPage />)

    expect(await screen.findByText('Admin quick login form')).toBeTruthy()
  })
})
