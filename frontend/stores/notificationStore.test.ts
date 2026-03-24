import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from './notificationStore'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}))

import { api } from '@/lib/api'

const mockApi = vi.mocked(api)

const SAMPLE_NOTIFICATIONS = [
  {
    id: '1',
    type: 'dna_ready' as const,
    title_zh: 'DNA 完成',
    title_en: 'DNA ready',
    body_zh: null,
    body_en: null,
    link: '/dna',
    is_read: false,
    created_at: '2026-03-24T10:00:00Z',
  },
  {
    id: '2',
    type: 'match_found' as const,
    title_zh: '新配對',
    title_en: 'New match',
    body_zh: null,
    body_en: null,
    link: '/matches',
    is_read: true,
    created_at: '2026-03-24T09:00:00Z',
  },
]

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
    })
    mockApi.mockReset()
  })

  afterEach(() => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
    })
  })

  describe('fetchNotifications', () => {
    it('fetches and stores notifications', async () => {
      mockApi.mockResolvedValueOnce({
        notifications: SAMPLE_NOTIFICATIONS,
        unread_count: 1,
      })

      await useNotificationStore.getState().fetchNotifications()

      const state = useNotificationStore.getState()
      expect(state.notifications).toHaveLength(2)
      expect(state.unreadCount).toBe(1)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockApi).toHaveBeenCalledWith('/notifications')
    })

    it('stores an error when fetch fails', async () => {
      mockApi.mockRejectedValueOnce(new Error('Network error'))

      await useNotificationStore.getState().fetchNotifications()

      const state = useNotificationStore.getState()
      expect(state.notifications).toHaveLength(0)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('Network error')
    })
  })

  describe('pollUnreadCount', () => {
    it('updates unread count', async () => {
      mockApi.mockResolvedValueOnce({ unread_count: 3 })

      await useNotificationStore.getState().pollUnreadCount()

      expect(useNotificationStore.getState().unreadCount).toBe(3)
      expect(mockApi).toHaveBeenCalledWith('/notifications/unread-count')
    })
  })

  describe('markAsRead', () => {
    it('optimistically marks notification as read', async () => {
      useNotificationStore.setState({
        notifications: SAMPLE_NOTIFICATIONS,
        unreadCount: 1,
      })
      mockApi.mockResolvedValueOnce({ ok: true })

      await useNotificationStore.getState().markAsRead('1')

      const state = useNotificationStore.getState()
      expect(state.notifications[0].is_read).toBe(true)
      expect(state.unreadCount).toBe(0)
      expect(mockApi).toHaveBeenCalledWith('/notifications/1/read', { method: 'PATCH' })
    })
  })

  describe('markAllAsRead', () => {
    it('optimistically marks all as read', async () => {
      useNotificationStore.setState({
        notifications: SAMPLE_NOTIFICATIONS,
        unreadCount: 1,
      })
      mockApi.mockResolvedValueOnce({ ok: true, updated: 1 })

      await useNotificationStore.getState().markAllAsRead()

      const state = useNotificationStore.getState()
      expect(state.notifications.every((n) => n.is_read)).toBe(true)
      expect(state.unreadCount).toBe(0)
      expect(mockApi).toHaveBeenCalledWith('/notifications/read-all', { method: 'PATCH' })
    })
  })
})
