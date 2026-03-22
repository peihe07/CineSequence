import { beforeEach, describe, expect, it, vi } from 'vitest'

const { clearTokenMock, getTokenMock, setTokenMock, apiMock, MockApiError } = vi.hoisted(() => {
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
    setTokenMock: vi.fn(),
    apiMock: vi.fn(),
    MockApiError: HoistedApiError,
  }
})

vi.mock('@/lib/api', () => ({
  ApiError: MockApiError,
  api: apiMock,
  clearToken: clearTokenMock,
  getToken: getTokenMock,
  setToken: setTokenMock,
}))

import { useAuthStore } from '@/stores/authStore'

describe('authStore', () => {
  beforeEach(() => {
    apiMock.mockReset()
    clearTokenMock.mockReset()
    getTokenMock.mockReset()
    setTokenMock.mockReset()
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

  it('does not clear the token on non-auth failures during fetchProfile', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u@test.com', name: 'User', gender: 'other', region: 'TW', avatar_url: null, sequencing_status: 'completed' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
    apiMock.mockRejectedValue(new MockApiError(500, 'Server error'))

    await useAuthStore.getState().fetchProfile()

    expect(clearTokenMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('u@test.com')
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('calls backend logout and clears auth state', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u@test.com', name: 'User', gender: 'other', region: 'TW', avatar_url: null, sequencing_status: 'completed' },
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
