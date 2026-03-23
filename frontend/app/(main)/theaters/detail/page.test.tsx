import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock, searchParamsState } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  searchParamsState: new URLSearchParams('id=mobius_loop'),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsState,
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.back': 'Back',
        'error.retry': 'Retry',
        'theaters.join': 'Join',
        'theaters.leave': 'Leave',
        'theaters.fit': 'Why You Fit',
        'theaters.recommended': 'Start With',
        'theaters.watchlist': 'Shared Watchlist',
        'theaters.messages': 'Message Board',
        'theaters.messagesEmpty': 'No one has opened the thread yet.',
        'theaters.messagePlaceholder': 'Write a note',
        'theaters.messageSend': 'Post Message',
        'theaters.messageDelete': 'Delete',
        'theaters.supporters': '{{count}} supporters',
      }
      let text = dict[key] ?? key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{{${name}}}`, String(value))
        }
      }
      return text
    },
  }),
}))

vi.mock('@/lib/tagLabels', () => ({
  getTagLabel: (tag: string) => tag,
}))

vi.mock('@/components/guards/FlowGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import TheaterDetailPage from './page'

describe('TheaterDetailPage', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads and renders theater detail', async () => {
    apiMock.mockResolvedValue({
      id: 'mobius_loop',
      name: 'Mobius Loop',
      subtitle: 'Mind-benders only',
      icon: 'ri-tornado-line',
      primary_tags: ['mindfuck'],
      is_hidden: false,
      member_count: 3,
      is_active: true,
      is_member: true,
      shared_tags: ['mindfuck'],
      member_preview: [],
      recommended_movies: [{ tmdb_id: 1, title_en: 'Pulp Fiction', match_tags: ['mindfuck'] }],
      shared_watchlist: [{ tmdb_id: 2, title_en: 'Arrival', match_tags: ['mindfuck'], supporter_count: 2 }],
      recent_messages: [{ id: 'm1', body: 'Start with Arrival.', created_at: '2026-03-23T12:00:00Z', can_delete: true, user: { id: 'u1', name: 'Ari', avatar_url: null } }],
    })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Mobius Loop')).toBeTruthy()
    })
    expect(apiMock).toHaveBeenCalledWith('/groups/mobius_loop')
    expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('2 supporters')).toBeTruthy()
    expect(screen.getByText('Start with Arrival.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Post Message' })).toBeTruthy()
  })
})
