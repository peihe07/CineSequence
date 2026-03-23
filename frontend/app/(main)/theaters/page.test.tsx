import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  fetchGroupsMock,
  autoAssignMock,
  joinGroupMock,
  leaveGroupMock,
  groupState,
} = vi.hoisted(() => ({
  fetchGroupsMock: vi.fn(),
  autoAssignMock: vi.fn(),
  joinGroupMock: vi.fn(),
  leaveGroupMock: vi.fn(),
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
    }>,
    isLoading: false,
  },
}))

vi.mock('@/stores/groupStore', () => ({
  useGroupStore: () => ({
    ...groupState,
    fetchGroups: fetchGroupsMock,
    autoAssign: autoAssignMock,
    joinGroup: joinGroupMock,
    leaveGroup: leaveGroupMock,
  }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
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
        'confirm.leaveGroup': 'Confirm leave group',
        'common.loading': 'Loading...',
        'common.confirm': 'Confirm',
        'common.cancel': 'Cancel',
      }
      return dict[key] ?? key
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
})
