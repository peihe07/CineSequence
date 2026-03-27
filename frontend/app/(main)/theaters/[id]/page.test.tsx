import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock, paramsState } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  paramsState: { id: 'mobius_loop' },
}))

vi.mock('next/navigation', () => ({
  useParams: () => paramsState,
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
        'common.cancel': 'Cancel',
        'error.retry': 'Retry',
        'theaters.join': 'Join',
        'theaters.leave': 'Leave',
        'theaters.fit': 'Why You Fit',
        'theaters.recommended': 'Start With',
        'theaters.watchlist': 'Shared Watchlist',
        'theaters.userLists': 'User Lists',
        'theaters.userListsEmpty': 'No lists yet.',
        'theaters.listTitlePlaceholder': 'List title',
        'theaters.listDescriptionPlaceholder': 'List description',
        'theaters.listItemsPlaceholder': 'One movie per line',
        'theaters.listCreate': 'Create List',
        'theaters.listBy': 'By {{name}}',
        'theaters.listItems': '{{count}} items',
        'theaters.messages': 'Message Board',
        'theaters.messagesHint': 'Trade one short note about what this room should watch next.',
        'theaters.messagesEmpty': 'No one has opened the thread yet.',
        'theaters.messagePlaceholder': 'Write a note',
        'theaters.messageSend': 'Post Message',
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

describe('TheaterDetailDynamicPage', () => {
  beforeEach(() => {
    apiMock.mockReset()
    paramsState.id = 'mobius_loop'
  })

  afterEach(() => {
    cleanup()
  })

  it('loads theater detail from dynamic route params', async () => {
    apiMock
      .mockResolvedValueOnce({
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
        recent_messages: [],
        recent_activity: [],
      })
      .mockResolvedValueOnce([])

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Mobius Loop')).toBeTruthy()
    })

    expect(apiMock).toHaveBeenNthCalledWith(1, '/groups/mobius_loop')
    expect(apiMock).toHaveBeenNthCalledWith(2, '/groups/mobius_loop/lists')
    expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    expect(screen.getByText('Arrival')).toBeTruthy()
  })
})
