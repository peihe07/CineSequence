import { create } from 'zustand'
import { api, clearToken, getToken, setToken } from '@/lib/api'

interface User {
  id: string
  email: string
  name: string
  gender: string
  region: string
  avatar_url: string | null
  sequencing_status: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  register: (data: {
    email: string
    name: string
    gender: string
    region?: string
    birth_year?: number
  }) => Promise<void>

  login: (email: string) => Promise<void>
  verify: (token: string) => Promise<void>
  fetchProfile: () => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!getToken(),
  isLoading: false,
  error: null,

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      await api<User>('/auth/register', {
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
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
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
      const { access_token } = await api<{ access_token: string }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      setToken(access_token)
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
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
      clearToken()
    }
  },

  logout: () => {
    clearToken()
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null }),
}))
