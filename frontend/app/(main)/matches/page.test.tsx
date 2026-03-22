import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  apiMock,
  searchParamsState,
  fetchMatchesMock,
  discoverMatchesMock,
  sendInviteMock,
  respondToInviteMock,
  matchState,
} = vi.hoisted(() => ({
  apiMock: vi.fn(),
  searchParamsState: {
    respond: null as string | null,
    match: null as string | null,
  },
  fetchMatchesMock: vi.fn(),
  discoverMatchesMock: vi.fn(),
  sendInviteMock: vi.fn(),
  respondToInviteMock: vi.fn(),
  matchState: {
    matches: [] as Array<{
      id: string
      partner_id: string
      partner_name: string
      similarity_score: number
      shared_tags: string[]
      ice_breakers: string[]
      status: 'discovered' | 'invited' | 'accepted' | 'declined'
      ticket_image_url: string | null
    }>,
    isLoading: false,
    isDiscovering: false,
    error: null as string | null,
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'respond' ? searchParamsState.respond : searchParamsState.match),
  }),
}))

vi.mock('@/stores/matchStore', () => ({
  useMatchStore: () => ({
    ...matchState,
    fetchMatches: fetchMatchesMock,
    discoverMatches: discoverMatchesMock,
    sendInvite: sendInviteMock,
    respondToInvite: respondToInviteMock,
  }),
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'matches.title': 'Your Matches',
        'matches.discover': 'Discover',
        'matches.discovering': 'Discovering...',
        'matches.empty': 'No matches yet',
        'matches.emptyHint': 'Try discovering matches',
        'matches.filterLabel': 'Match Preferences',
        'matches.prefGender': 'Gender',
        'matches.prefAny': 'Any',
        'matches.prefFemale': 'Female',
        'matches.prefMale': 'Male',
        'matches.prefOther': 'Other',
        'matches.prefAge': 'Age range',
        'matches.pureTaste': 'Pure taste',
        'matches.pureTasteHint': 'Ignore gender and age',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/lib/tagLabels', () => ({
  getTagLabel: (tag: string) => tag,
}))

vi.mock('@/components/match/TearRitual', () => ({
  default: () => <div>TearRitual</div>,
}))

vi.mock('@/components/guards/FlowGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import MatchesPage from './page'

describe('MatchesPage', () => {
  beforeEach(() => {
    apiMock.mockReset()
    fetchMatchesMock.mockReset()
    discoverMatchesMock.mockReset()
    sendInviteMock.mockReset()
    respondToInviteMock.mockReset()
    searchParamsState.respond = null
    searchParamsState.match = null
    matchState.matches = []
    matchState.isLoading = false
    matchState.isDiscovering = false
    matchState.error = null
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a visible error when loading profile preferences fails', async () => {
    apiMock.mockRejectedValue(new Error('Profile load failed'))

    render(<MatchesPage />)

    expect(await screen.findByText('Profile load failed')).toBeTruthy()
  })

  it('rolls back local preference changes when saving fails', async () => {
    apiMock
      .mockResolvedValueOnce({
        match_gender_pref: null,
        match_age_min: null,
        match_age_max: null,
        pure_taste_match: false,
      })
      .mockRejectedValueOnce(new Error('Save failed'))

    render(<MatchesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Match Preferences' }))
    fireEvent.click(screen.getByRole('button', { name: 'Female' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ match_gender_pref: 'female' }),
      })
    })

    expect(await screen.findByText('Save failed')).toBeTruthy()
    expect(screen.queryByText('Profile load failed')).toBeNull()
  })

  it('renders match action errors from the store', async () => {
    apiMock.mockResolvedValue({
      match_gender_pref: null,
      match_age_min: null,
      match_age_max: null,
      pure_taste_match: false,
    })
    matchState.error = 'Invite failed'

    render(<MatchesPage />)

    expect(await screen.findByText('Invite failed')).toBeTruthy()
  })
})
