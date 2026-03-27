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
      recent_activity: Array<{
        id: string
        type: 'list_created' | 'list_replied'
        created_at: string
        actor: { id: string; name: string; avatar_url: string | null }
        list_id: string
        list_title: string
        body: string | null
      }>
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
        'theaters.nextStep': 'Your DNA has opened the theater layer.',
        'theaters.assignmentReady': 'These rooms are where your shared curation starts.',
        'theaters.autoAssign': 'DNA Assign',
        'theaters.empty': 'No theaters assigned yet',
        'theaters.emptyHint': 'Run DNA Assign to map your current profile into matching rooms.',
        'theaters.join': 'Join',
        'theaters.leave': 'Leave',
        'theaters.hidden': 'Hidden',
        'theaters.active': 'Active',
        'theaters.inactive': 'Not yet active',
        'theaters.fit': 'Why You Fit',
        'theaters.fitHint': 'These are the strongest tags connecting your taste to this room.',
        'theaters.featured': 'Primary Theater',
        'theaters.featuredHint': 'Start with the titles that best represent this room.',
        'theaters.library': 'Other Rooms',
        'theaters.libraryHint': 'You can still enter these rooms, but your primary theater should lead the read.',
        'theaters.cardHintMember': 'You are already inside this room',
        'theaters.cardHintVisitor': 'Read the room first, then decide whether to join',
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
        'theaters.activity': 'Recent Activity',
        'theaters.activityHint': 'New lists and replies surface here first.',
        'theaters.activityEmpty': 'No list activity yet.',
        'theaters.activityListCreated': '{{name}} started "{{title}}"',
        'theaters.activityListReplied': '{{name}} replied to "{{title}}"',
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
    expect(screen.getByText('Your DNA has opened the theater layer.')).toBeTruthy()
    expect(screen.getByText('No theaters assigned yet')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /DNA Assign/i })[0])

    await waitFor(() => {
      expect(autoAssignMock).toHaveBeenCalled()
    })
  })

  it('renders featured theater curation before the remaining room library', () => {
    groupState.groups = [
      {
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
        recent_activity: [
          {
            id: 'a1',
            type: 'list_created',
            created_at: '2026-03-27T13:00:00Z',
            actor: { id: 'u1', name: 'Ari', avatar_url: null },
            list_id: 'l1',
            list_title: 'Late-Night Brain Melt',
            body: null,
          },
          {
            id: 'a2',
            type: 'list_replied',
            created_at: '2026-03-27T14:00:00Z',
            actor: { id: 'u2', name: 'Bea', avatar_url: null },
            list_id: 'l1',
            list_title: 'Late-Night Brain Melt',
            body: 'Burning should follow Arrival.',
          },
        ],
      },
      {
        id: 'afterhours',
        name: 'Afterhours',
        subtitle: 'Nocturnal melancholia',
        icon: 'ri-moon-clear-line',
        primary_tags: ['slowburn'],
        is_hidden: false,
        member_count: 1,
        is_active: false,
        is_member: false,
        shared_tags: ['slowburn'],
        member_preview: [],
        recommended_movies: [
          { tmdb_id: 3, title_en: 'Chungking Express', match_tags: ['slowburn'] },
        ],
        shared_watchlist: [],
        recent_messages: [],
        recent_activity: [],
      },
    ]

    render(<TheatersPage />)

    expect(screen.getByText('Primary Theater')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Mobius Loop' })).toBeTruthy()
    expect(screen.getAllByText('Why You Fit').length).toBeGreaterThan(0)
    expect(screen.getAllByText('mindfuck').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Start With').length).toBeGreaterThan(0)
    expect(screen.getByText('Pulp Fiction')).toBeTruthy()
    expect(screen.getAllByText('Shared Watchlist').length).toBeGreaterThan(0)
    expect(screen.getByText('Arrival')).toBeTruthy()
    expect(screen.getByText('Recent Activity')).toBeTruthy()
    expect(screen.getByText('Ari started "Late-Night Brain Melt"')).toBeTruthy()
    expect(screen.getByText('Bea replied to "Late-Night Brain Melt"')).toBeTruthy()
    expect(screen.getByText('Burning should follow Arrival.')).toBeTruthy()
    expect(screen.getByText('Other Rooms')).toBeTruthy()
    expect(screen.getByText('Afterhours')).toBeTruthy()
    expect(screen.getByText('Read the room first, then decide whether to join')).toBeTruthy()
    const openLinks = screen.getAllByRole('link', { name: /Open Theater/i })
    expect(openLinks.length).toBe(2)
    expect(openLinks[0]?.getAttribute('href')).toBe('/theaters/mobius_loop')
    expect(openLinks[1]?.getAttribute('href')).toBe('/theaters/afterhours')
  })
})
