import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replaceMock,
  verifyMock,
  fetchProgressMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  verifyMock: vi.fn(),
  fetchProgressMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    verify: verifyMock,
    error: 'Invalid token',
  }),
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: (selector: (s: { fetchProgress: typeof fetchProgressMock }) => unknown) =>
    selector({ fetchProgress: fetchProgressMock }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'auth.verifying': 'Verifying...',
        'auth.verified': 'Verified',
        'auth.redirecting': 'Redirecting...',
        'auth.verifyFailed': 'Verification failed',
        'auth.invalidLink': 'Invalid or expired link',
        'auth.newLink': 'Request a new link',
      }
      return dict[key] ?? key
    },
  }),
}))

import { VerifyContent } from './VerifyContent'

function triggerRedirectTimerImmediately() {
  const originalSetTimeout = globalThis.setTimeout

  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 1500 && typeof callback === 'function') {
      return originalSetTimeout(() => callback(...args), 0)
    }

    return originalSetTimeout(callback, delay, ...args)
  }) as typeof setTimeout)
}

describe('VerifyPage', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    verifyMock.mockReset()
    fetchProgressMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('verifies a token and redirects to seed when sequencing has not started', async () => {
    verifyMock.mockResolvedValue(undefined)
    fetchProgressMock.mockResolvedValue({
      seed_movie_tmdb_id: null,
      round_number: 1,
    })
    triggerRedirectTimerImmediately()

    render(<VerifyContent token="valid-token" />)

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledWith('valid-token')
    })
    expect(await screen.findByText('Verified')).toBeTruthy()

    await waitFor(() => {
      expect(fetchProgressMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/sequencing/seed')
    })
  }, 10000)

  it('verifies a token and redirects to sequencing when progress already exists', async () => {
    verifyMock.mockResolvedValue(undefined)
    fetchProgressMock.mockResolvedValue({
      seed_movie_tmdb_id: 99,
      round_number: 6,
    })
    triggerRedirectTimerImmediately()

    render(<VerifyContent token="valid-token" />)

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledWith('valid-token')
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/sequencing')
    })
  }, 10000)

  it('shows an error state when verification fails', async () => {
    verifyMock.mockRejectedValue(new Error('nope'))

    render(<VerifyContent token="bad-token" />)

    expect(await screen.findByText('Verification failed')).toBeTruthy()
    expect(screen.getByText('Invalid token')).toBeTruthy()
  }, 10000)
})
