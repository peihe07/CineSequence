import { beforeEach, describe, expect, it, vi } from 'vitest'

const { clearTokenMock, getTokenMock, apiMock, MockApiError } = vi.hoisted(() => {
  class HoistedApiError extends Error {
    status: number
    detail: string

    constructor(status: number, detail: string) {
      super(detail)
      this.status = status
      this.detail = detail
      this.name = 'ApiError'
    }
  }

  return {
    clearTokenMock: vi.fn(),
    getTokenMock: vi.fn(() => null),
    apiMock: vi.fn(),
    MockApiError: HoistedApiError,
  }
})

vi.mock('@/lib/api', () => ({
  ApiError: MockApiError,
  api: apiMock,
  clearToken: clearTokenMock,
  getToken: getTokenMock,
}))

import { useAuthStore } from '@/stores/authStore'

describe('authStore', () => {
  beforeEach(() => {
    apiMock.mockReset()
    clearTokenMock.mockReset()
    getTokenMock.mockReset()
    getTokenMock.mockReturnValue(null)
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  })

  it('clears the token on 401 responses during fetchProfile', async () => {
    apiMock.mockRejectedValue(new MockApiError(401, 'Unauthorized'))

    await useAuthStore.getState().fetchProfile()

    expect(clearTokenMock).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('returns the register success payload so the UI can render it', async () => {
    apiMock.mockResolvedValue({
      message: 'If this email is eligible, a magic link has been sent.',
    })

    await expect(
      useAuthStore.getState().register({
        email: 'u@test.com',
        name: 'User',
        gender: 'other',
        region: 'TW',
        birth_year: 1990,
        agreed_to_terms: true,
      }),
    ).resolves.toEqual({
      message: 'If this email is eligible, a magic link has been sent.',
    })

    expect(apiMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'u@test.com',
        name: 'User',
        gender: 'other',
        region: 'TW',
        birth_year: 1990,
        agreed_to_terms: true,
      }),
    })
  })

  it('hydrates the user after verify succeeds via cookie-backed profile fetch', async () => {
    apiMock
      .mockResolvedValueOnce({
        access_token: 'jwt-token',
        token_type: 'bearer',
      })
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'u@test.com',
        name: 'User',
        gender: 'other',
        region: 'TW',
        avatar_url: null,
        sequencing_status: 'completed',
        is_admin: false,
      })

    await useAuthStore.getState().verify('magic-link-token')

    expect(apiMock).toHaveBeenNthCalledWith(1, '/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'magic-link-token' }),
    })
    expect(apiMock).toHaveBeenNthCalledWith(2, '/profile')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('u@test.com')
  })

  it('does not rely on localStorage token after verify succeeds', async () => {
    apiMock
      .mockResolvedValueOnce({
        access_token: 'jwt-token',
        token_type: 'bearer',
      })
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'u@test.com',
        name: 'User',
        gender: 'other',
        region: 'TW',
        avatar_url: null,
        sequencing_status: 'completed',
        is_admin: false,
      })

    await useAuthStore.getState().verify('magic-link-token')

    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('does not clear the token on non-auth failures during fetchProfile', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u@test.com', name: 'User', gender: 'other', region: 'TW', avatar_url: null, sequencing_status: 'completed', is_admin: false },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
    apiMock.mockRejectedValue(new MockApiError(500, 'Server error'))

    await expect(useAuthStore.getState().fetchProfile()).rejects.toThrow('Server error')

    expect(clearTokenMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('u@test.com')
    expect(useAuthStore.getState().isLoading).toBe(false)
    expect(useAuthStore.getState().error).toBe('Server error')
  })

  it('calls backend logout and clears auth state', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u@test.com', name: 'User', gender: 'other', region: 'TW', avatar_url: null, sequencing_status: 'completed', is_admin: false },
      isAuthenticated: true,
      isLoading: false,
      error: 'old error',
    })
    apiMock.mockResolvedValue(undefined)

    await useAuthStore.getState().logout()

    expect(apiMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })
    expect(clearTokenMock).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().error).toBeNull()
  })
})
