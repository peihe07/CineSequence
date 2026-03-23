import { create } from 'zustand'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'

interface Group {
  id: string
  name: string
  subtitle: string
  icon: string
  primary_tags: string[]
  is_hidden: boolean
  member_count: number
  is_active: boolean
  is_member: boolean
  shared_tags: string[]
  member_preview: Array<{
    id: string
    name: string
    avatar_url: string | null
  }>
  recommended_movies: Array<{
    tmdb_id: number
    title_en: string
    match_tags: string[]
  }>
  shared_watchlist: Array<{
    tmdb_id: number
    title_en: string
    match_tags: string[]
    supporter_count: number
  }>
  recent_messages: Array<{
    id: string
    body: string
    created_at: string
    user: {
      id: string
      name: string
      avatar_url: string | null
    }
    can_delete: boolean
  }>
}

interface GroupState {
  groups: Group[]
  isLoading: boolean
  error: string | null

  fetchGroups: () => Promise<void>
  autoAssign: () => Promise<void>
  joinGroup: (groupId: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  postGroupMessage: (groupId: string, body: string) => Promise<void>
  deleteGroupMessage: (groupId: string, messageId: string) => Promise<void>
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  isLoading: false,
  error: null,

  fetchGroups: async () => {
    set({ isLoading: true, error: null })
    try {
      const groups = await api<Group[]>('/groups')
      set({ groups, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
    }
  },

  autoAssign: async () => {
    set({ isLoading: true, error: null })
    try {
      await api<Group[]>('/groups/auto-assign', { method: 'POST' })
      // Refresh full list after auto-assign
      const groups = await api<Group[]>('/groups')
      set({ groups, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
    }
  },

  joinGroup: async (groupId: string) => {
    try {
      const updated = await api<Group>(`/groups/${groupId}/join`, { method: 'POST' })
      set({
        groups: get().groups.map((g) =>
          g.id === groupId ? { ...g, ...updated, is_member: true } : g
        ),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ error: message })
    }
  },

  leaveGroup: async (groupId: string) => {
    try {
      const updated = await api<Group>(`/groups/${groupId}/leave`, { method: 'POST' })
      set({
        groups: get().groups.map((g) =>
          g.id === groupId ? { ...g, ...updated, is_member: false } : g
        ),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ error: message })
    }
  },

  postGroupMessage: async (groupId, body) => {
    try {
      const message = await api<Group['recent_messages'][number]>(`/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      set({
        groups: get().groups.map((g) =>
          g.id === groupId
            ? { ...g, recent_messages: [...g.recent_messages, message].slice(-8) }
            : g
        ),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ error: message })
    }
  },

  deleteGroupMessage: async (groupId, messageId) => {
    try {
      await api(`/groups/${groupId}/messages/${messageId}`, {
        method: 'DELETE',
      })
      set({
        groups: get().groups.map((g) =>
          g.id === groupId
            ? { ...g, recent_messages: g.recent_messages.filter((message) => message.id !== messageId) }
            : g
        ),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ error: message })
    }
  },
}))
