import { create } from 'zustand'
import { api } from '@/lib/api'

export interface NotificationItem {
  id: string
  type: 'dna_ready' | 'match_found' | 'invite_received' | 'match_accepted' | 'system'
  title_zh: string
  title_en: string
  body_zh: string | null
  body_en: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

interface NotificationListResponse {
  notifications: NotificationItem[]
  unread_count: number
}

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean
  /** Fetch notification list + unread count */
  fetchNotifications: () => Promise<void>
  /** Lightweight poll for unread count only */
  pollUnreadCount: () => Promise<void>
  /** Mark a single notification as read */
  markAsRead: (id: string) => Promise<void>
  /** Mark all as read */
  markAllAsRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true })
    try {
      const data = await api<NotificationListResponse>('/notifications')
      set({
        notifications: data.notifications,
        unreadCount: data.unread_count,
      })
    } catch {
      // Silently fail — polling will retry
    } finally {
      set({ isLoading: false })
    }
  },

  pollUnreadCount: async () => {
    try {
      const data = await api<{ unread_count: number }>('/notifications/unread-count')
      set({ unreadCount: data.unread_count })
    } catch {
      // Silently fail
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    const prev = get().notifications
    set({
      notifications: prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: Math.max(0, get().unreadCount - 1),
    })
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' })
    } catch {
      // Rollback on failure
      set({ notifications: prev, unreadCount: get().unreadCount + 1 })
    }
  },

  markAllAsRead: async () => {
    const prev = get().notifications
    const prevCount = get().unreadCount
    set({
      notifications: prev.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })
    try {
      await api('/notifications/read-all', { method: 'PATCH' })
    } catch {
      set({ notifications: prev, unreadCount: prevCount })
    }
  },
}))
