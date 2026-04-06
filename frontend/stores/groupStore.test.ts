import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

import { useGroupStore } from '@/stores/groupStore'

describe('groupStore', () => {
  const group = {
    id: 'group-1',
    name: 'Night Owls',
    subtitle: 'Late-night curation',
    icon: 'moon',
    primary_tags: ['moody'],
    is_hidden: false,
    member_count: 3,
    is_active: true,
    is_member: true,
    shared_tags: ['moody', 'romance'],
    member_preview: [],
    recommended_movies: [],
    shared_watchlist: [],
    recent_messages: [],
    recent_activity: [],
  }

  beforeEach(() => {
    apiMock.mockReset()
    useGroupStore.setState({
      groups: [group],
      isLoading: false,
      error: null,
      hasHydrated: false,
    })
  })

  it('uses the auto-assign response directly without refetching groups', async () => {
    const assignedGroups = [{ ...group, name: 'Assigned Hall' }]
    apiMock.mockResolvedValueOnce(assignedGroups)

    await expect(useGroupStore.getState().autoAssign()).resolves.toBeUndefined()

    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledWith('/groups/auto-assign', { method: 'POST' })
    expect(useGroupStore.getState().groups).toEqual(assignedGroups)
    expect(useGroupStore.getState().isLoading).toBe(false)
  })

  it('keeps existing groups visible during a background refresh', async () => {
    apiMock.mockResolvedValueOnce([{ ...group, name: 'Refreshed Hall' }])

    const pending = useGroupStore.getState().fetchGroups({ background: true })

    expect(useGroupStore.getState().isLoading).toBe(false)
    expect(useGroupStore.getState().groups[0]?.name).toBe('Night Owls')

    await pending

    expect(useGroupStore.getState().groups[0]?.name).toBe('Refreshed Hall')
  })

  it('trims group messages before posting', async () => {
    const createdMessage = {
      id: 'message-1',
      body: 'hello theater',
      created_at: '2026-03-27T10:00:00Z',
      user: {
        id: 'user-1',
        name: 'Pei',
        avatar_url: null,
      },
      can_delete: true,
    }
    apiMock.mockResolvedValueOnce(createdMessage)

    await expect(
      useGroupStore.getState().postGroupMessage('group-1', '   hello theater   ')
    ).resolves.toBeUndefined()

    expect(apiMock).toHaveBeenCalledWith('/groups/group-1/messages', {
      method: 'POST',
      body: JSON.stringify({ body: 'hello theater' }),
    })
    expect(useGroupStore.getState().groups[0]?.recent_messages).toEqual([createdMessage])
  })

  it('does not call the API for whitespace-only group messages', async () => {
    await expect(useGroupStore.getState().postGroupMessage('group-1', '   ')).resolves.toBeUndefined()

    expect(apiMock).not.toHaveBeenCalled()
    expect(useGroupStore.getState().groups[0]?.recent_messages).toEqual([])
  })
})
