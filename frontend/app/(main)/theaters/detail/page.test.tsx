import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
        'theaters.carouselControls': '{{shelf}} controls',
        'theaters.carouselShelf': '{{shelf}} shelf',
        'theaters.carouselPrevious': 'Previous {{shelf}} card',
        'theaters.carouselNext': 'Next {{shelf}} card',
        'theaters.userLists': 'User Lists',
        'theaters.tabs': 'Theater sections',
        'theaters.tabOverview': 'Overview',
        'theaters.tabLists': 'Curated Lists',
        'theaters.tabBoard': 'Board',
        'theaters.userListsEmpty': 'No lists yet.',
        'theaters.listTitlePlaceholder': 'List title',
        'theaters.listDescriptionPlaceholder': 'List description',
        'theaters.listItemsPlaceholder': 'One movie per line',
        'theaters.listCreate': 'Create List',
        'theaters.listEdit': 'Edit List',
        'theaters.listUpdate': 'Save List',
        'theaters.listDelete': 'Delete List',
        'theaters.listExpand': 'Expand List',
        'theaters.listCollapse': 'Collapse List',
        'theaters.listBy': 'By {{name}}',
        'theaters.listItems': '{{count}} items',
        'theaters.listItemPlaceholder': 'Add one more title to this room list',
        'theaters.listItemAdd': 'Add Title',
        'theaters.listItemRemove': 'Remove',
        'theaters.listItemMoveUp': 'Move Up',
        'theaters.listItemMoveDown': 'Move Down',
        'theaters.listItemNotePlaceholder': 'Add a short curator note',
        'theaters.listItemNoteSave': 'Save Note',
        'theaters.listMovieSearchPlaceholder': 'Search TMDB title',
        'theaters.listMovieSearch': 'Search Movie',
        'theaters.listReplies': 'Replies',
        'theaters.listRepliesCount': '{{count}} replies',
        'theaters.listRepliesExpand': 'Open replies',
        'theaters.listRepliesCollapse': 'Hide replies',
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

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}))

import TheaterDetailPage, { __resetTheaterDetailSearchCacheForTests } from './page'
import { __resetTheaterDetailCacheForTests } from './useTheaterDetail'

describe('TheaterDetailPage', () => {
  beforeEach(() => {
    apiMock.mockReset()
    __resetTheaterDetailCacheForTests()
    __resetTheaterDetailSearchCacheForTests()
  })

  afterEach(() => {
    cleanup()
  })

  async function openListsTab() {
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Curated Lists' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Curated Lists' }))
  }

  async function openBoardTab() {
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Board' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Board' }))
  }

  async function expandList(title = 'Late-Night Brain Melt') {
    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy()
    })

    const listCard = screen.getByText(title).closest('article')
    if (!listCard) {
      throw new Error(`List card not found for ${title}`)
    }

    fireEvent.click(within(listCard).getByRole('button', { name: 'Expand List' }))
  }

  async function expandReplies(title = 'Late-Night Brain Melt') {
    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy()
    })

    const listCard = screen.getByText(title).closest('article')
    if (!listCard) {
      throw new Error(`List card not found for ${title}`)
    }

    fireEvent.click(within(listCard).getByRole('button', { name: 'Open replies' }))
  }

  function getListCard(title = 'Late-Night Brain Melt') {
    const listCard = screen.getByText(title).closest('article')
    if (!listCard) {
      throw new Error(`List card not found for ${title}`)
    }
    return listCard
  }

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
          items: [
            {
              id: 'i1',
              tmdb_id: 11,
              title_en: 'Arrival',
              title_zh: null,
              poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
              genres: [],
              runtime_minutes: null,
              match_tags: ['mindfuck'],
              note: 'Starts quiet, then keeps unfolding.',
              position: 0,
            },
          ],
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
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Curated Lists' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Board' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Shared Watchlist' }))
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('2 supporters')).toBeTruthy()

    await openListsTab()
    await expandList()
    expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    expect(screen.getByText('By Ari')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Arrival' }).getAttribute('src')).toBe('https://image.tmdb.org/t/p/w500/arrival.jpg')
    expect(screen.getByText('Starts quiet, then keeps unfolding.')).toBeTruthy()

    await openBoardTab()
    expect(screen.getByText('Start with Arrival.')).toBeTruthy()
  }, 10000)

  it('switches overview between starter shelf and watchlist shelf', async () => {
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
      })
      .mockResolvedValueOnce([])

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    })

    expect(screen.queryByText('2 supporters')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Shared Watchlist' }))
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('2 supporters')).toBeTruthy()
    expect(screen.queryByText('Pulp Fiction')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Start With' }))
    expect(screen.getByText('Pulp Fiction')).toBeTruthy()
  })

  it('shows overview carousel controls when a shelf has multiple titles', async () => {
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
        recommended_movies: [
          { tmdb_id: 1, title_en: 'Pulp Fiction', match_tags: ['mindfuck'] },
          { tmdb_id: 3, title_en: 'Perfect Blue', match_tags: ['identity'] },
        ],
        shared_watchlist: [
          { tmdb_id: 2, title_en: 'Arrival', match_tags: ['mindfuck'], supporter_count: 2 },
          { tmdb_id: 4, title_en: 'Burning', match_tags: ['ambiguity'], supporter_count: 1 },
        ],
        recent_messages: [],
      })
      .mockResolvedValueOnce([])

    render(<TheaterDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: 'Previous Start With card' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next Start With card' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Shared Watchlist' }))
    expect(screen.getByRole('button', { name: 'Previous Shared Watchlist card' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next Shared Watchlist card' })).toBeTruthy()
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

    await openListsTab()
    fireEvent.click(screen.getByRole('button', { name: 'Create List' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(screen.getByPlaceholderText('List title'), { target: { value: 'Midnight Rotation' } })
    fireEvent.change(screen.getByPlaceholderText('List description'), { target: { value: 'For after the room goes quiet.' } })
    fireEvent.change(screen.getByPlaceholderText('One movie per line'), { target: { value: 'Arrival\nBurning' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create List' }))

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
    await expandList('Midnight Rotation')
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('Burning')).toBeTruthy()
  })

  it('creates a list with selected TMDB movie metadata from search', async () => {
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
      .mockResolvedValueOnce([
        {
          tmdb_id: 11,
          title_en: 'Arrival',
          title_zh: '異星入境',
          poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
          year: 2016,
          genres: ['Science Fiction'],
          runtime_minutes: 116,
        },
      ])
      .mockResolvedValueOnce({
        id: 'l3',
        group_id: 'mobius_loop',
        title: 'Signal Drift',
        description: 'Matched directly from TMDB.',
        visibility: 'group',
        created_at: '2026-03-27T13:00:00Z',
        updated_at: '2026-03-27T13:00:00Z',
        creator: { id: 'u1', name: 'Ari', avatar_url: null },
        items: [
          {
            id: 'i3',
            tmdb_id: 11,
            title_en: 'Arrival',
            title_zh: '異星入境',
            poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
            genres: ['Science Fiction'],
            runtime_minutes: 116,
            match_tags: [],
            note: null,
            position: 0,
          },
        ],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await openListsTab()
    fireEvent.click(screen.getByRole('button', { name: 'Create List' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(screen.getByPlaceholderText('List title'), { target: { value: 'Signal Drift' } })
    fireEvent.change(screen.getByPlaceholderText('List description'), { target: { value: 'Matched directly from TMDB.' } })
    fireEvent.change(screen.getByPlaceholderText('Search TMDB title'), { target: { value: 'Arrival' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search Movie' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/sequencing/search?q=Arrival')
    })

    fireEvent.click(await within(dialog).findByRole('button', { name: /異星入境.*2016/ }))

    await waitFor(() => {
      expect(screen.getByText('異星入境')).toBeTruthy()
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create List' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(4, '/groups/mobius_loop/lists', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Signal Drift',
          description: 'Matched directly from TMDB.',
          items: [
            {
              tmdb_id: 11,
              title_en: 'Arrival',
              title_zh: '異星入境',
              poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
              genres: ['Science Fiction'],
              runtime_minutes: 116,
              match_tags: [],
              note: null,
            },
          ],
        }),
      })
    })
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

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit List' }))

    const titleInputs = screen.getAllByPlaceholderText('List title')
    const descriptionInputs = screen.getAllByPlaceholderText('List description')

    fireEvent.change(titleInputs[0], { target: { value: 'Midnight Rotation' } })
    fireEvent.change(descriptionInputs[0], { target: { value: 'For after the room goes quiet.' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save List' }).getAttribute('disabled')).toBeNull()
    })
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

    await openListsTab()
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

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })
    await expandList()

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
    expect(screen.getAllByText('Burning').length).toBeGreaterThan(0)
  })

  it('appends a list item with TMDB metadata from search', async () => {
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
      .mockResolvedValueOnce([
        {
          tmdb_id: 11,
          title_en: 'Arrival',
          title_zh: '異星入境',
          poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
          year: 2016,
          genres: ['Science Fiction'],
          runtime_minutes: 116,
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
          {
            id: 'i1',
            tmdb_id: 11,
            title_en: 'Arrival',
            title_zh: '異星入境',
            poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
            genres: ['Science Fiction'],
            runtime_minutes: 116,
            match_tags: [],
            note: null,
            position: 0,
          },
        ],
        replies: [],
      })

    render(<TheaterDetailPage />)

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })
    await expandList()

    fireEvent.change(screen.getByPlaceholderText('Search TMDB title'), {
      target: { value: 'Arrival' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search Movie' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/sequencing/search?q=Arrival')
    })

    fireEvent.click(screen.getByRole('button', { name: /異星入境.*2016/ }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(4, '/groups/mobius_loop/lists/l1/items', {
        method: 'POST',
        body: JSON.stringify({
          tmdb_id: 11,
          title_en: 'Arrival',
          title_zh: '異星入境',
          poster_url: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
          genres: ['Science Fiction'],
          runtime_minutes: 116,
          match_tags: [],
          note: null,
        }),
      })
    })

    expect(screen.getAllByText('異星入境').length).toBeGreaterThan(0)
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

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })
    await expandList()

    fireEvent.click(screen.getAllByRole('button', { name: 'Move Up' })[1])

    await waitFor(() => {
      expect(apiMock).toHaveBeenNthCalledWith(3, '/groups/mobius_loop/lists/l1/items/reorder', {
        method: 'PATCH',
        body: JSON.stringify({
          item_ids: ['i2', 'i1'],
        }),
      })
    })

    const reorderedTitles = screen.getAllByText(/Arrival|Burning/).map((node) => node.textContent)
    expect(reorderedTitles[0]).toBe('Burning +1')
    expect(reorderedTitles).toContain('Burning')
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

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })
    await expandList()

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

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })
    await expandList()
    await expandReplies()

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

  it('keeps replies collapsed until explicitly opened', async () => {
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
          replies: [
            {
              id: 'r1',
              body: 'Burning should be the follow-up slot.',
              created_at: '2026-03-27T12:10:00Z',
              can_delete: true,
              user: { id: 'u1', name: 'Ari', avatar_url: null },
            },
          ],
        },
      ])

    render(<TheaterDetailPage />)

    await openListsTab()
    await expandList()

    const listCard = getListCard()
    expect(screen.queryByText('Burning should be the follow-up slot.')).toBeNull()
    expect(within(listCard).getAllByText('1 replies').length).toBeGreaterThan(0)

    await expandReplies()
    expect(screen.getByText('Burning should be the follow-up slot.')).toBeTruthy()
  })

  it('shows list summary chips before a card is expanded', async () => {
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
            {
              id: 'i1',
              tmdb_id: 11,
              title_en: 'Arrival',
              title_zh: null,
              poster_url: null,
              genres: [],
              runtime_minutes: null,
              match_tags: [],
              note: null,
              position: 0,
            },
            {
              id: 'i2',
              tmdb_id: 12,
              title_en: 'Burning',
              title_zh: null,
              poster_url: null,
              genres: [],
              runtime_minutes: null,
              match_tags: [],
              note: null,
              position: 1,
            },
          ],
          replies: [
            {
              id: 'r1',
              body: 'Burning should be the follow-up slot.',
              created_at: '2026-03-27T12:10:00Z',
              can_delete: true,
              user: { id: 'u1', name: 'Ari', avatar_url: null },
            },
          ],
        },
      ])

    render(<TheaterDetailPage />)

    await openListsTab()
    await waitFor(() => {
      expect(screen.getByText('Late-Night Brain Melt')).toBeTruthy()
    })

    const listCard = getListCard()
    expect(within(listCard).getAllByText('2 items').length).toBeGreaterThan(0)
    expect(within(listCard).getByText('Arrival +1')).toBeTruthy()
    expect(within(listCard).getAllByText('1 replies').length).toBeGreaterThan(0)
    expect(screen.queryByText('Burning should be the follow-up slot.')).toBeNull()
  })
})
