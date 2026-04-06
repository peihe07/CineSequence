import { create } from 'zustand'
import { ApiError, api, clearToken } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'
import type {
  LoginRequest,
  LoginResponse,
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
  hasHydrated: boolean
  lastFetchedAt: number | null

  register: (data: RegisterRequest) => Promise<RegisterResponse>

  login: (email: string, nextPath?: string) => Promise<LoginResponse>
  verify: (token: string) => Promise<void>
  fetchProfile: (options?: { force?: boolean }) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AUTH_CACHE_TTL_MS = 30_000
let inflightProfileRequest: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  hasHydrated: false,
  lastFetchedAt: null,

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set({ isLoading: false })
      return response
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
      throw err
    }
  },

  login: async (email, nextPath) => {
    set({ isLoading: true, error: null })
    try {
      const payload: LoginRequest = { email, next_path: nextPath }
      const response = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      set({ isLoading: false })
      return response
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
      throw err
    }
  },

  verify: async (token) => {
    set({ isLoading: true, error: null })
    try {
      const payload: VerifyRequest = { token }
      await api<VerifyResponse>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await get().fetchProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
      throw err
    }
  },

  fetchProfile: async (options) => {
    const { hasHydrated, lastFetchedAt, isLoading } = get()
    const shouldUseCache = !options?.force
      && hasHydrated
      && lastFetchedAt !== null
      && Date.now() - lastFetchedAt < AUTH_CACHE_TTL_MS

    if (shouldUseCache) return
    if (inflightProfileRequest) return inflightProfileRequest

    if (!isLoading) {
      set({ isLoading: true })
    }

    inflightProfileRequest = (async () => {
      try {
        const user = await api<User>('/profile')
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          hasHydrated: true,
          lastFetchedAt: Date.now(),
        })
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            hasHydrated: true,
            lastFetchedAt: Date.now(),
          })
          clearToken()
          return
        }

        set({
          isLoading: false,
          error: err instanceof Error ? err.message : translateStatic('common.error'),
          hasHydrated: true,
        })
        throw err
      } finally {
        inflightProfileRequest = null
      }
    })()

    return inflightProfileRequest
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Best effort: local state should still reset.
    }
    clearToken()
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      hasHydrated: true,
      lastFetchedAt: Date.now(),
    })
  },

  clearError: () => set({ error: null }),
}))
