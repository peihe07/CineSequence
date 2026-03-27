import { create } from 'zustand'
import { api } from '@/lib/api'
import { translateStatic } from '@/lib/i18n'
import type { TheaterGroup } from '@/lib/theater-types'

interface GroupState {
  groups: TheaterGroup[]
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
      const groups = await api<TheaterGroup[]>('/groups')
      set({ groups, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
    }
  },

  autoAssign: async () => {
    set({ isLoading: true, error: null })
    try {
      const groups = await api<TheaterGroup[]>('/groups/auto-assign', { method: 'POST' })
      set({ groups, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : translateStatic('common.error')
      set({ isLoading: false, error: message })
    }
  },

  joinGroup: async (groupId: string) => {
    try {
      const updated = await api<TheaterGroup>(`/groups/${groupId}/join`, { method: 'POST' })
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
      const updated = await api<TheaterGroup>(`/groups/${groupId}/leave`, { method: 'POST' })
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
    const trimmedBody = body.trim()
    if (!trimmedBody) {
      return
    }

    try {
      const message = await api<TheaterGroup['recent_messages'][number]>(`/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmedBody }),
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
