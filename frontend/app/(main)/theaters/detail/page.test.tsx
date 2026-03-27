import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
        'theaters.listEdit': 'Edit List',
        'theaters.listUpdate': 'Save List',
        'theaters.listDelete': 'Delete List',
        'theaters.listBy': 'By {{name}}',
        'theaters.listItems': '{{count}} items',
        'theaters.listItemPlaceholder': 'Add one more title to this room list',
        'theaters.listItemAdd': 'Add Title',
        'theaters.listItemRemove': 'Remove',
        'theaters.listItemMoveUp': 'Move Up',
        'theaters.listItemMoveDown': 'Move Down',
        'theaters.listItemNotePlaceholder': 'Add a short curator note',
        'theaters.listItemNoteSave': 'Save Note',
        'theaters.listReplies': 'Replies',
        'theaters.listRepliesEmpty': 'No one has responded to this list yet.',
        'theaters.listReplyPlaceholder': 'Respond to this list',
        'theaters.listReplySend': 'Post Reply',
        'theaters.listReplyDelete': 'Delete Reply',
        'theaters.messages': 'Message Board',
        'theaters.messagesHint': 'Trade one short note about what this room should watch next.',
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
        recent_messages: [{ id: 'm1', body: 'Start with Arrival.', created_at: '2026-03-23T12:00:00Z', can_delete: true, user: { id: 'u1', name: 'Ari', avatar_url: null } }],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [],
          replies: [],
        },
      ])

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Mobius Loop')).toBeTruthy()
    })
    expect(apiMock).toHaveBeenNthCalledWith(1, '/groups/mobius_loop')
    expect(apiMock).toHaveBeenNthCalledWith(2, '/groups/mobius_loop/lists')
    expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('2 supporters')).toBeTruthy()
    expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    expect(screen.getByText('By Ari')).toBeTruthy()
    expect(screen.getByText('Start with Arrival.')).toBeTruthy()
    expect(screen.getByText('Trade one short note about what this room should watch next.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Post Message' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create List' })).toBeTruthy()
  })

  it('creates a list with seeded item titles', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'l2',
        group_id: 'mobius_loop',
        title: 'Midnight Rotation',
        description: 'For after the room goes quiet.',
        visibility: 'group',
        created_at: '2026-03-27T13:00:00Z',
        updated_at: '2026-03-27T13:00:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [
          { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: 'Seeded from quick-create flow.', position: 0 },
          { id: 'i2', tmdb_id: 0, title_en: 'Burning', match_tags: [], note: null, position: 1 },
        ],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('List title')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create List' }).getAttribute('disabled')).toBeNull()
    })

    fireEvent.change(screen.getByPlaceholderText('List title'), { target: { value: 'Midnight Rotation' } })
    fireEvent.change(screen.getByPlaceholderText('List description'), { target: { value: 'For after the room goes quiet.' } })
    fireEvent.change(screen.getByPlaceholderText('One movie per line'), { target: { value: 'Arrival\nBurning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create List' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Midnight Rotation',
          description: 'For after the room goes quiet.',
          items: [
            {
              tmdb_id: 0,
              title_en: 'Arrival',
              title_zh: null,
              poster_url: null,
              genres: [],
              runtime_minutes: null,
              match_tags: [],
              note: 'Seeded from quick-create flow.',
            },
            {
              tmdb_id: 0,
              title_en: 'Burning',
              title_zh: null,
              poster_url: null,
              genres: [],
              runtime_minutes: null,
              match_tags: [],
              note: null,
            },
          ],
        }),
      })
    })

    expect(screen.getByText('Midnight Rotation')).toBeTruthy()
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('Burning')).toBeTruthy()
  })

  it('updates list title and description', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [],
          replies: [],
        },
      ])
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Midnight Rotation',
        description: 'For after the room goes quiet.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:05:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit List' }))

    const titleInputs = screen.getAllByPlaceholderText('List title')
    const descriptionInputs = screen.getAllByPlaceholderText('List description')

    fireEvent.change(titleInputs[0], { target: { value: 'Midnight Rotation' } })
    fireEvent.change(descriptionInputs[0], { target: { value: 'For after the room goes quiet.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save List' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Midnight Rotation',
          description: 'For after the room goes quiet.',
        }),
      })
    })

    expect(screen.getByText('Midnight Rotation')).toBeTruthy()
    expect(screen.getAllByText('For after the room goes quiet.').length).toBeGreaterThan(0)
  })

  it('deletes a list', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [],
          replies: [],
        },
      ])
      .mockResolvedValueOnce(undefined)

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete List' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1', {
        method: 'DELETE',
      })
    })

    expect(screen.queryByText('Late-Night Brain Melt')).toBeNull()
  })

  it('appends and removes list items', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [
            { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: null, position: 0 },
          ],
          replies: [],
        },
      ])
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Late-Night Brain Melt',
        description: 'Built for spiral conversations after midnight.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:10:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [
          { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: null, position: 0 },
          { id: 'i2', tmdb_id: 0, title_en: 'Burning', match_tags: [], note: null, position: 1 },
        ],
        replies: [],
      })
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Late-Night Brain Melt',
        description: 'Built for spiral conversations after midnight.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:12:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [
          { id: 'i2', tmdb_id: 0, title_en: 'Burning', match_tags: [], note: null, position: 0 },
        ],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('Add one more title to this room list'), {
      target: { value: 'Burning' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Title' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1/items', {
        method: 'POST',
        body: JSON.stringify({
          tmdb_id: 0,
          title_en: 'Burning',
          title_zh: null,
          poster_url: null,
          genres: [],
          runtime_minutes: null,
          match_tags: [],
          note: null,
        }),
      })
    })

    expect(screen.getAllByText('Burning')).toHaveLength(1)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(4, '/groups/mobius_loop/lists/l1/items/i1', {
        method: 'DELETE',
      })
    })

    expect(screen.queryByText('Arrival')).toBeNull()
    expect(screen.getByText('Burning')).toBeTruthy()
  })

  it('reorders list items', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [
            { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: null, position: 0 },
            { id: 'i2', tmdb_id: 0, title_en: 'Burning', match_tags: [], note: null, position: 1 },
          ],
          replies: [],
        },
      ])
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Late-Night Brain Melt',
        description: 'Built for spiral conversations after midnight.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:05:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [
          { id: 'i2', tmdb_id: 0, title_en: 'Burning', match_tags: [], note: null, position: 0 },
          { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: null, position: 1 },
        ],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Move Up' })[1])

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1/items/reorder', {
        method: 'PATCH',
        body: JSON.stringify({
          item_ids: ['i2', 'i1'],
        }),
      })
    })

    expect(screen.getAllByText(/Arrival|Burning/)[0].textContent).toBe('Burning')
  })

  it('updates an item note', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [
            { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: null, position: 0 },
          ],
          replies: [],
        },
      ])
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Late-Night Brain Melt',
        description: 'Built for spiral conversations after midnight.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:08:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [
          { id: 'i1', tmdb_id: 0, title_en: 'Arrival', match_tags: [], note: 'Use this as the entry point.', position: 0 },
        ],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('Add a short curator note'), {
      target: { value: 'Use this as the entry point.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1/items/i1', {
        method: 'PATCH',
        body: JSON.stringify({ note: 'Use this as the entry point.' }),
      })
    })

    expect(screen.getByText('Use this as the entry point.')).toBeTruthy()
  })

  it('posts and deletes replies under a list', async () => {
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
        recommended_movies: [],
        shared_watchlist: [],
        recent_messages: [],
      })
      .mockResolvedValueOnce([
        {
          id: 'l1',
          group_id: 'mobius_loop',
          title: 'Late-Night Brain Melt',
          description: 'Built for spiral conversations after midnight.',
          visibility: 'group',
          created_at: '2026-03-27T12:00:00Z',
          updated_at: '2026-03-27T12:00:00Z',
          creator: { id: 'u1', name: 'Ari', avatar_url: null },
          items: [],
          replies: [],
        },
      ])
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Late-Night Brain Melt',
        description: 'Built for spiral conversations after midnight.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:10:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [],
        replies: [
          {
            id: 'r1',
            body: 'Burning should be the follow-up slot.',
            created_at: '2026-03-27T12:10:00Z',
            can_delete: true,
            user: { id: 'u1', name: 'Ari', avatar_url: null },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'l1',
        group_id: 'mobius_loop',
        title: 'Late-Night Brain Melt',
        description: 'Built for spiral conversations after midnight.',
        visibility: 'group',
        created_at: '2026-03-27T12:00:00Z',
        updated_at: '2026-03-27T12:12:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('Respond to this list'), {
      target: { value: 'Burning should be the follow-up slot.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post Reply' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1/replies', {
        method: 'POST',
        body: JSON.stringify({ body: 'Burning should be the follow-up slot.' }),
      })
    })

    expect(screen.getByText('Burning should be the follow-up slot.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Reply' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(4, '/groups/mobius_loop/lists/l1/replies/r1', {
        method: 'DELETE',
      })
    })

    expect(screen.queryByText('Burning should be the follow-up slot.')).toBeNull()
  })
})
