import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

vi.mock('@/lib/i18n', () => ({
  translateStatic: (key: string) => (key === 'common.error' ? 'Error' : key),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}))

import {
  __resetTheaterDetailCacheForTests,
  prefetchTheaterDetail,
  useTheaterDetail,
} from './useTheaterDetail'

describe('useTheaterDetail', () => {
  beforeEach(() => {
    apiMock.mockReset()
    __resetTheaterDetailCacheForTests()
  })

  it('prefetches theater detail and reuses cached data on mount', async () => {
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

    await prefetchTheaterDetail('mobius_loop')

    const { result } = renderHook(() => useTheaterDetail('mobius_loop'))

    await waitFor(() => {
      expect(result.current.group?.name).toBe('Mobius Loop')
    })

    expect(result.current.group?.name).toBe('Mobius Loop')
    expect(result.current.lists[0]?.title).toBe('Late-Night Brain Melt')
    expect(apiMock).toHaveBeenCalledTimes(2)
  })

  it('does not call mutation APIs when groupId is missing', async () => {
    const { result } = renderHook(() => useTheaterDetail(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.joinGroup()
      await result.current.leaveGroup()
      await result.current.deleteMessage('message-1')
      await result.current.deleteList('list-1')
      await result.current.deleteListItem('list-1', 'item-1')
      await result.current.deleteListReply('list-1', 'reply-1')
    })

    await expect(result.current.postMessage('hello')).resolves.toBe(false)
    await expect(
      result.current.createList({
        title: 'Midnight Rotation',
        description: 'For after the room goes quiet.',
        itemTitles: ['Arrival'],
      })
    ).resolves.toBe(false)
    await expect(
      result.current.updateList('list-1', {
        title: 'Updated',
        description: 'Still quiet.',
      })
    ).resolves.toBe(false)
    await expect(result.current.appendListItem('list-1', 'Arrival')).resolves.toBe(false)
    await expect(result.current.updateListItemNote('list-1', 'item-1', 'Start here.')).resolves.toBe(false)
    await expect(result.current.reorderListItems('list-1', ['item-1'])).resolves.toBe(false)
    await expect(result.current.postListReply('list-1', 'Love this pick')).resolves.toBe(false)

    expect(apiMock).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Error')
    expect(result.current.isMutating).toBe(false)
  })
})
