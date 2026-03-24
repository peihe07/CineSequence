import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock, storeState, authState } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  authState: {
    isAuthenticated: true,
  },
  storeState: {
    notifications: [] as Array<{
      id: string
      type: 'dna_ready' | 'match_found' | 'invite_received' | 'match_accepted' | 'system'
      title_zh: string
      title_en: string
      body_zh: string | null
      body_en: string | null
      link: string | null
      is_read: boolean
      created_at: string
    }>,
    unreadCount: 0,
    fetchNotifications: vi.fn(),
    pollUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'notification.bell': 'Notifications',
        'notification.list': 'Notification list',
        'notification.title': 'Notifications',
        'notification.viewAll': 'View all',
        'notification.empty': 'No notifications yet',
        'notification.unread': 'unread',
        'notification.markAllRead': 'Mark all read',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => boolean) => selector(authState),
}))

vi.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => storeState,
}))

import NotificationBell from './NotificationBell'

describe('NotificationBell', () => {
  beforeEach(() => {
    pushMock.mockReset()
    storeState.notifications = []
    storeState.unreadCount = 0
    storeState.fetchNotifications.mockReset()
    storeState.pollUnreadCount.mockReset()
    storeState.markAsRead.mockReset()
    storeState.markAllAsRead.mockReset()
    authState.isAuthenticated = true
  })

  afterEach(() => {
    cleanup()
  })

  it('navigates to notifications page from the dropdown footer', () => {
    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'View all' }))

    expect(pushMock).toHaveBeenCalledWith('/notifications')
  })
})
