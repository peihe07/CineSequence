import { create } from 'zustand'
import { ApiError, api, clearToken, setToken } from '@/lib/api'
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  User,
  VerifyRequest,
  VerifyResponse,
} from '@/lib/auth-types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  register: (data: RegisterRequest) => Promise<void>

  login: (email: string) => Promise<void>
  verify: (token: string) => Promise<void>
  fetchProfile: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      await api<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set({ isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  login: async (email) => {
    set({ isLoading: true, error: null })
    try {
      const payload: LoginRequest = { email }
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      set({ isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  verify: async (token) => {
    set({ isLoading: true, error: null })
    try {
      const payload: VerifyRequest = { token }
      const response = await api<VerifyResponse>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setToken(response.access_token)
      set({ isAuthenticated: true, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true })
    try {
      const user = await api<User>('/profile')
      set({ user, isAuthenticated: true, isLoading: false, error: null })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        set({ user: null, isAuthenticated: false, isLoading: false, error: null })
        clearToken()
        return
      }

      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch profile',
      })
      throw err
    }
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Best effort: local state should still reset.
    }
    clearToken()
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null }),
}))
