import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  fetchGroupsMock,
  autoAssignMock,
  joinGroupMock,
  leaveGroupMock,
  postGroupMessageMock,
  deleteGroupMessageMock,
  groupState,
} = vi.hoisted(() => ({
  fetchGroupsMock: vi.fn(),
  autoAssignMock: vi.fn(),
  joinGroupMock: vi.fn(),
  leaveGroupMock: vi.fn(),
  postGroupMessageMock: vi.fn(),
  deleteGroupMessageMock: vi.fn(),
  groupState: {
    groups: [] as Array<{
      id: string
      name: string
      subtitle: string
      icon: string
      primary_tags: string[]
      is_hidden: boolean
      member_count: number
      is_active: boolean
      is_member: boolean
      shared_tags: string[]
      member_preview: Array<{ id: string; name: string; avatar_url: string | null }>
      recommended_movies: Array<{ tmdb_id: number; title_en: string; match_tags: string[] }>
      shared_watchlist: Array<{ tmdb_id: number; title_en: string; match_tags: string[]; supporter_count: number }>
      recent_messages: Array<{ id: string; body: string; created_at: string; can_delete: boolean; user: { id: string; name: string; avatar_url: string | null } }>
    }>,
    isLoading: false,
  },
}))

vi.mock('@/stores/groupStore', () => ({
  useGroupStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      ...groupState,
      fetchGroups: fetchGroupsMock,
      autoAssign: autoAssignMock,
      joinGroup: joinGroupMock,
      leaveGroup: leaveGroupMock,
      postGroupMessage: postGroupMessageMock,
      deleteGroupMessage: deleteGroupMessageMock,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        'theaters.title': 'Theaters',
        'theaters.autoAssign': 'DNA Assign',
        'theaters.empty': 'No theaters joined yet',
        'theaters.emptyHint': 'Click "DNA Assign" to auto-join theaters based on your cinematic DNA',
        'theaters.join': 'Join',
        'theaters.leave': 'Leave',
        'theaters.hidden': 'Hidden',
        'theaters.active': 'Active',
        'theaters.inactive': 'Not yet active',
        'theaters.fit': 'Why You Fit',
        'theaters.fitHint': 'These are the strongest tags connecting your taste to this room.',
        'theaters.noSharedTags': 'No overlap yet',
        'theaters.members': 'Members',
        'theaters.membersEmpty': 'No visible members yet.',
        'theaters.recommended': 'Start With',
        'theaters.watchlist': 'Shared Watchlist',
        'theaters.watchlistHint': 'Ranked by current member overlap, these are the films this room is most likely to rally around.',
        'theaters.supporters': '{{count}} supporters',
        'theaters.messages': 'Message Board',
        'theaters.messagesHint': 'Trade one short note about what this room should watch next.',
        'theaters.messagesEmpty': 'No one has opened the thread yet.',
        'theaters.messagePlaceholder': 'Drop a short note about what this theater should watch next, or your first read on the room.',
        'theaters.messageSend': 'Post Message',
        'theaters.messageDelete': 'Delete',
        'theaters.open': 'Open Theater',
        'confirm.leaveGroup': 'Confirm leave group',
        'common.loading': 'Loading...',
        'common.confirm': 'Confirm',
        'common.cancel': 'Cancel',
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

import TheatersPage from './page'

describe('TheatersPage', () => {
  beforeEach(() => {
    fetchGroupsMock.mockReset()
    autoAssignMock.mockReset()
    joinGroupMock.mockReset()
    leaveGroupMock.mockReset()
    postGroupMessageMock.mockReset()
    deleteGroupMessageMock.mockReset()
    groupState.groups = []
    groupState.isLoading = false
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty state and triggers dna assign', async () => {
    render(<TheatersPage />)

    expect(fetchGroupsMock).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Theaters' })).toBeTruthy()
    expect(screen.getByText('No theaters joined yet')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /DNA Assign/i })[0])

    await waitFor(() => {
      expect(autoAssignMock).toHaveBeenCalled()
    })
  })

  it('renders theater details for fit, members, and recommendations', () => {
    groupState.groups = [{
      id: 'mobius_loop',
      name: 'Mobius Loop',
      subtitle: 'Mind-benders only',
      icon: 'ri-tornado-line',
      primary_tags: ['mindfuck', 'twist'],
      is_hidden: false,
      member_count: 3,
      is_active: true,
      is_member: true,
      shared_tags: ['mindfuck'],
      member_preview: [
        { id: 'u1', name: 'Ari', avatar_url: null },
        { id: 'u2', name: 'Bea', avatar_url: null },
      ],
      recommended_movies: [
        { tmdb_id: 1, title_en: 'Pulp Fiction', match_tags: ['twist'] },
      ],
      shared_watchlist: [
        { tmdb_id: 2, title_en: 'Arrival', match_tags: ['mindfuck', 'twist'], supporter_count: 2 },
      ],
      recent_messages: [
        {
          id: 'm1',
          body: 'I think this room should rewatch Arrival.',
          created_at: '2026-03-23T12:00:00Z',
          can_delete: true,
          user: { id: 'u1', name: 'Ari', avatar_url: null },
        },
      ],
    }]

    render(<TheatersPage />)

    expect(screen.getByText('Why You Fit')).toBeTruthy()
    expect(screen.getAllByText('mindfuck').length).toBeGreaterThan(0)
    expect(screen.getByText('Members')).toBeTruthy()
    expect(screen.getAllByText('Ari').length).toBeGreaterThan(0)
    expect(screen.getByText('Start With')).toBeTruthy()
    expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open Theater/i })).toBeTruthy()
  })
})
