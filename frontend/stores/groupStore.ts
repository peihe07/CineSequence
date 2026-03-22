import { create } from 'zustand'
import { api } from '@/lib/api'

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
}

interface GroupState {
  groups: Group[]
  isLoading: boolean
  error: string | null

  fetchGroups: () => Promise<void>
  autoAssign: () => Promise<void>
  joinGroup: (groupId: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
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
      const message = err instanceof Error ? err.message : 'Failed to load groups'
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
      const message = err instanceof Error ? err.message : 'Auto-assign failed'
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
      const message = err instanceof Error ? err.message : 'Join failed'
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
      const message = err instanceof Error ? err.message : 'Leave failed'
      set({ error: message })
    }
  },
}))
