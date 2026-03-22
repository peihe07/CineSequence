import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  verifyMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  verifyMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    verify: verifyMock,
    error: 'Invalid token',
  }),
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

describe('VerifyPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    verifyMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('verifies a token and redirects to sequencing', async () => {
    verifyMock.mockResolvedValue(undefined)

    render(<VerifyContent token="valid-token" />)

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledWith('valid-token')
    })
    expect(await screen.findByText('Verified')).toBeTruthy()

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/sequencing')
    }, { timeout: 2500 })
  }, 10000)

  it('shows an error state when verification fails', async () => {
    verifyMock.mockRejectedValue(new Error('nope'))

    render(<VerifyContent token="bad-token" />)

    expect(await screen.findByText('Verification failed')).toBeTruthy()
    expect(screen.getByText('Invalid token')).toBeTruthy()
  }, 10000)
})
