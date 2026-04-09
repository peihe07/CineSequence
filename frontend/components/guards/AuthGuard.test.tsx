import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchProfileMock, replaceMock, authState } = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  replaceMock: vi.fn(),
  authState: {
    isAuthenticated: false,
    isLoading: false,
    hasHydrated: false,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => '/sequencing',
  useSearchParams: () => new URLSearchParams('mode=mobile'),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'error.retry': 'Retry',
    }[key] ?? key),
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    hasHydrated: authState.hasHydrated,
    fetchProfile: fetchProfileMock,
  }),
}))

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

import AuthGuard from './AuthGuard'

describe('AuthGuard', () => {
  beforeEach(() => {
    fetchProfileMock.mockReset()
    replaceMock.mockReset()
    authState.isAuthenticated = false
    authState.isLoading = false
    authState.hasHydrated = false
  })

  afterEach(() => {
    cleanup()
  })

  it('fetches the profile before rendering when auth has not hydrated yet', async () => {
    fetchProfileMock.mockResolvedValue(undefined)

    render(
      <AuthGuard>
        <p>Protected app</p>
      </AuthGuard>,
    )

    await waitFor(() => {
      expect(fetchProfileMock).toHaveBeenCalledTimes(1)
    })
  })

  it('renders immediately without refetching when auth state is already hydrated', () => {
    authState.hasHydrated = true
    authState.isAuthenticated = true

    render(
      <AuthGuard>
        <p>Protected app</p>
      </AuthGuard>,
    )

    expect(fetchProfileMock).not.toHaveBeenCalled()
    expect(screen.getByText('Protected app')).toBeTruthy()
  })

  it('redirects unauthenticated users to login with the current path', async () => {
    authState.hasHydrated = true
    authState.isAuthenticated = false

    render(
      <AuthGuard>
        <p>Protected app</p>
      </AuthGuard>,
    )

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login?next=%2Fsequencing%3Fmode%3Dmobile')
    })
    expect(screen.queryByText('Protected app')).toBeNull()
  })
})
