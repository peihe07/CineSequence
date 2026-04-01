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
          partner_email: string | null
          partner_bio: string | null
          partner_avatar_url: string | null
          partner_archetype: string | null
          similarity_score: number
          candidate_percentile: number | null
          candidate_pool_size: number | null
          shared_tags: string[]
          ice_breakers: string[]
          status: 'discovered' | 'invited' | 'accepted' | 'declined'
          ticket_image_url: string | null
          is_recipient: boolean
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

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
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
        'matches.minAge': 'Minimum age',
        'matches.maxAge': 'Maximum age',
        'matches.pureTaste': 'Pure taste',
        'matches.pureTasteHint': 'Ignore gender and age',
        'matches.prefLoadError': 'Failed to load match preferences',
        'matches.prefSaveError': 'Failed to save match preferences',
        'matches.results': 'Match results',
        'matches.loading': 'Loading matches',
        'matches.matched': 'Matched',
        'matches.tearHint': 'Drag to tear open',
        'matches.viewTicket': 'Open ticket',
        'matches.closeTicket': 'Close ticket',
        'matches.ticketGenerating': 'Generating ticket',
        'matches.emailPartner': 'Email partner',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/lib/tagLabels', () => ({
  getTagLabel: (tag: string) => tag,
}))

vi.mock('@/components/match/TearRitual', () => ({
  default: ({ onTear }: { onTear?: () => void }) => (
    <button type="button" onClick={onTear}>
      TearRitual
    </button>
  ),
}))

vi.mock('@/components/guards/FlowGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import MatchesPage from './page'

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
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
    vi.unstubAllGlobals()
    cleanup()
  })

  it('shows a visible error when loading profile preferences fails', async () => {
    apiMock.mockRejectedValue(new Error('Profile load failed'))

    render(<MatchesPage />)

    expect(await screen.findByText('Profile load failed')).toBeTruthy()
  })

  it('rolls back local preference changes when saving fails', async () => {
    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/profile' && !options) {
        return Promise.resolve({
          match_gender_pref: null,
          match_age_min: null,
          match_age_max: null,
          pure_taste_match: false,
        })
      }

      if (path === '/profile' && options?.method === 'PATCH') {
        return Promise.reject(new Error('Save failed'))
      }

      return Promise.resolve(undefined)
    })

    render(<MatchesPage />)

    const filterToggle = await screen.findByRole('button', { name: 'Match Preferences' })
    await waitFor(() => {
      if (filterToggle.hasAttribute('disabled')) {
        throw new Error('Filter toggle is still disabled')
      }
    })

    fireEvent.click(filterToggle)
    fireEvent.click(screen.getByRole('button', { name: 'Female' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ match_gender_pref: 'female' }),
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Any' }).className).toContain('filterActive')
      expect(screen.getByRole('button', { name: 'Female' }).className).not.toContain('filterActive')
    })
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

  it('opens and closes the accepted ticket modal from the tear ritual', async () => {
    apiMock.mockResolvedValue({
      match_gender_pref: null,
      match_age_min: null,
      match_age_max: null,
      pure_taste_match: false,
    })
    matchState.matches = [{
      id: 'match-1',
      partner_id: 'partner-1',
      partner_name: 'Jamie',
      partner_email: 'jamie@example.com',
      partner_bio: 'Likes slow cinema',
      partner_avatar_url: null,
      partner_archetype: 'The Archivist',
      similarity_score: 0.91,
      candidate_percentile: 97,
      candidate_pool_size: 100,
      shared_tags: ['noir'],
      ice_breakers: ['Ask about first Wong Kar-wai watch'],
      status: 'accepted',
      ticket_image_url: 'https://example.com/ticket.png',
      is_recipient: false,
    }]

    render(<MatchesPage />)

    expect(screen.queryByRole('button', { name: 'Open ticket Jamie' })).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: 'TearRitual' }))

    expect(await screen.findByRole('dialog', { name: 'Jamie — Open ticket' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /jamie@example.com/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close ticket' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Jamie — Open ticket' })).toBeNull()
    })
  })
})
