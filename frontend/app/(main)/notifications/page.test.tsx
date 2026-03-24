import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock, storeState } = vi.hoisted(() => ({
  pushMock: vi.fn(),
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
    isLoading: false,
    error: null as string | null,
    fetchNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) => {
      const dict: Record<string, string> = {
        'notifications.fileLabel': 'NTF-06',
        'notifications.pageTitle': 'Signals',
        'notifications.deck': 'Notification deck',
        'notifications.total': `${vars?.count ?? '0'} total`,
        'notifications.unreadCount': `${vars?.count ?? '0'} unread`,
        'notification.markAllRead': 'Mark all read',
        'notification.empty': 'No notifications yet',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => storeState,
}))

import NotificationsPage from './page'

describe('NotificationsPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    storeState.notifications = []
    storeState.unreadCount = 0
    storeState.isLoading = false
    storeState.error = null
    storeState.fetchNotifications.mockReset()
    storeState.markAsRead.mockReset()
    storeState.markAllAsRead.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads notifications on mount', async () => {
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(storeState.fetchNotifications).toHaveBeenCalledTimes(1)
    })
  })

  it('shows an error instead of empty state when fetch fails', () => {
    storeState.error = 'Load failed'

    render(<NotificationsPage />)

    expect(screen.getByText('Load failed')).toBeTruthy()
    expect(screen.queryByText('No notifications yet')).toBeNull()
  })

  it('marks unread notifications as read and navigates on click', () => {
    storeState.notifications = [
      {
        id: 'n1',
        type: 'match_found',
        title_zh: '新通知',
        title_en: 'New signal',
        body_zh: null,
        body_en: 'Open the match',
        link: '/matches',
        is_read: false,
        created_at: '2026-03-24T10:00:00Z',
      },
    ]
    storeState.unreadCount = 1

    render(<NotificationsPage />)

    fireEvent.click(screen.getByRole('button', { name: /New signal/i }))

    expect(storeState.markAsRead).toHaveBeenCalledWith('n1')
    expect(pushMock).toHaveBeenCalledWith('/matches')
  })
})
