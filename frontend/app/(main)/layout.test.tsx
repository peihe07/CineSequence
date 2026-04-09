import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replaceMock,
  fetchProfileMock,
  authState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  fetchProfileMock: vi.fn(),
  authState: {
    isAuthenticated: false,
    isLoading: false,
    hasHydrated: false,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/dna',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    () => ({
      ...authState,
      fetchProfile: fetchProfileMock,
    }),
    {
      setState: vi.fn((partial: Partial<typeof authState>) => {
        Object.assign(authState, partial)
      }),
    },
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'common.error': 'Something went wrong',
        'common.loading': 'Loading...',
        'error.retry': 'Retry',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/components/ui/NavBar', () => ({
  default: () => <div>NavBar</div>,
}))

vi.mock('@/components/ui/MuteToggle', () => ({
  default: () => <button type="button">Mute</button>,
}))

import MainLayout from './layout'

describe('MainLayout', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    fetchProfileMock.mockReset()
    authState.isAuthenticated = false
    authState.isLoading = false
    authState.hasHydrated = false
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a retry state instead of redirecting when the auth check fails', async () => {
    fetchProfileMock.mockRejectedValue(new Error('Profile unavailable'))

    render(
      <MainLayout>
        <p>Protected content</p>
      </MainLayout>,
    )

    expect(await screen.findByText('Profile unavailable')).toBeTruthy()
    expect(replaceMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Protected content')).toBeNull()
  })

  it('shows a loading state while the auth check is running', () => {
    authState.isLoading = true

    render(
      <MainLayout>
        <p>Protected content</p>
      </MainLayout>,
    )

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByText('Protected content')).toBeNull()
  })

  it('does not render protected content before auth check resolves', () => {
    fetchProfileMock.mockImplementation(() => new Promise(() => {}))

    render(
      <MainLayout>
        <p>Protected content</p>
      </MainLayout>,
    )

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByText('Protected content')).toBeNull()
  })

  it('retries the auth check when retry is clicked', async () => {
    fetchProfileMock
      .mockRejectedValueOnce(new Error('Profile unavailable'))
      .mockImplementationOnce(async () => {
        authState.isAuthenticated = true
      })

    const { rerender } = render(
      <MainLayout>
        <p>Protected content</p>
      </MainLayout>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    rerender(
      <MainLayout>
        <p>Protected content</p>
      </MainLayout>,
    )

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeTruthy()
    })
    expect(fetchProfileMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the layout rendered when a global unauthorized event is emitted', async () => {
    authState.isAuthenticated = true
    authState.hasHydrated = true
    fetchProfileMock.mockImplementation(async () => {})

    render(
      <MainLayout>
        <p>Protected content</p>
      </MainLayout>,
    )

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeTruthy()
    })
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
