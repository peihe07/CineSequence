import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock, fetchMatchMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  fetchMatchMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'inviteId' ? 'abc123' : null),
  }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/stores/matchStore', () => ({
  useMatchStore: () => ({
    fetchMatch: fetchMatchMock,
  }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'ticket.title': 'Match Ticket',
        'ticket.similarity': 'Taste Similarity',
        'ticket.sharedTags': 'Shared Tastes',
        'ticket.iceBreakers': 'Conversation Starters',
        'ticket.backToMatches': 'Back to Matches',
        'ticket.notFound': 'Ticket not found',
        'ticket.notAccepted': 'Match not yet confirmed',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/lib/tagLabels', () => ({
  getTagLabel: (tag: string) => tag,
}))

vi.mock('@/components/match/TicketCard', () => ({
  default: () => <div>TicketCard</div>,
}))

import TicketPage from './page'

describe('TicketPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    fetchMatchMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders accepted match details and returns to matches', async () => {
    fetchMatchMock.mockResolvedValue({
      id: 'abc123',
      ticket_image_url: null,
      partner_name: 'Aster',
      similarity_score: 0.87,
      shared_tags: ['neo-noir'],
      ice_breakers: ['Start with favorite endings'],
      status: 'accepted',
    })

    render(<TicketPage />)

    expect(await screen.findByRole('heading', { name: 'Match Ticket' })).toBeTruthy()
    expect(screen.getByText('87%')).toBeTruthy()
    expect(screen.getByText('neo-noir')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Back to Matches/i }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/matches')
    })
  })
})
