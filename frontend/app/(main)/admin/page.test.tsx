import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'admin.title': 'Admin Dashboard',
        'admin.loadFailed': 'Failed to load',
        'admin.totalUsers': 'Total Users',
        'admin.today': 'Today',
        'admin.thisWeek': 'This Week',
        'admin.dnaProfiles': 'DNA Profiles',
        'admin.totalMatches': 'Total Matches',
        'admin.acceptRate': 'Accept Rate',
        'admin.userFunnel': 'User Funnel',
        'admin.registered': 'Registered',
        'admin.completedSequencing': 'Completed Sequencing',
        'admin.hasDna': 'Has DNA',
        'admin.hasMatch': 'Has Match',
        'admin.dailyRegistrations': 'Daily Registrations',
        'admin.dailyDnaBuilds': 'Daily DNA Builds',
        'admin.dailyMatches': 'Daily Matches',
        'admin.noData': 'No data yet',
        'admin.matchStatus': 'Match Status',
        'admin.estimatedApiUsage': 'Estimated API Usage',
        'admin.personalityReadings': 'Personality readings',
        'admin.iceBreakers': 'Ice breakers',
        'admin.aiPairs': 'AI pairs',
        'admin.total': 'Total',
        'admin.queries': 'Queries',
        'admin.inviteEmails': 'Invite emails',
        'admin.inviteReminderEmails': 'Invite reminder emails',
        'admin.acceptedEmails': 'Accepted emails',
        'admin.tokenUsage': 'Token Usage',
        'admin.calls': 'Calls',
        'admin.promptTokens': 'Prompt tokens',
        'admin.completionTokens': 'Completion tokens',
        'admin.estimatedCost': 'Est. cost',
        'admin.totalTokens': 'Total tokens',
        'admin.daysSuffix': 'd',
        'admin.waitlist': 'Waitlist',
        'admin.waitlistTotal': 'Total signups',
        'admin.waitlistEmail': 'Email',
        'admin.waitlistSource': 'Source',
        'admin.waitlistCreatedAt': 'Joined',
        'admin.waitlistEmpty': 'No waitlist entries yet',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('./charts/MiniChart', () => ({
  default: () => <div>MiniChart</div>,
}))

vi.mock('./charts/DonutChart', () => ({
  default: () => <div>DonutChart</div>,
}))

vi.mock('./charts/StackedBar', () => ({
  default: () => <div>StackedBar</div>,
}))

import AdminPage from './page'

describe('AdminPage', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the waitlist section with entries from the admin API', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === '/admin/stats') {
        return Promise.resolve({
          users: { total: 5, today: 1, this_week: 3, sequencing_breakdown: { completed: 2 } },
          dna: { total_active: 2, archetype_distribution: {} },
          matches: { total: 1, status_breakdown: { accepted: 1 }, invite_rate: 1, accept_rate: 1 },
          funnel: { registered: 5, completed_sequencing: 2, has_dna: 2, has_match: 2 },
          trends: { users: 10, dna: 0, matches: -5 },
        })
      }
      if (path === '/admin/stats/daily?days=30') {
        return Promise.resolve({
          days: 30,
          registrations: [],
          dna_builds: [],
          matches: [],
        })
      }
      if (path === '/admin/api-usage') {
        return Promise.resolve({
          gemini: {
            personality_readings: 2,
            ice_breakers: 1,
            ai_pairs: 1,
            estimated_total: 4,
            token_usage: {},
            total_prompt_tokens: 10,
            total_completion_tokens: 5,
            total_tokens: 15,
            estimated_total_cost_usd: 0.12,
          },
          tmdb: { estimated_queries: 7 },
          resend: { invite_emails: 1, invite_reminder_emails: 0, accepted_emails: 1, estimated_total: 2 },
        })
      }
      if (path === '/admin/waitlist') {
        return Promise.resolve({
          total: 2,
          entries: [
            { email: 'newer@test.com', source: 'popup', created_at: '2026-03-31T10:00:00Z' },
            { email: 'older@test.com', source: 'landing', created_at: '2026-03-30T08:00:00Z' },
          ],
        })
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })

    render(<AdminPage />)

    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeTruthy()

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/admin/waitlist')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Waitlist' }))

    const waitlistTable = screen.getByRole('table', { name: 'Waitlist' })

    expect(screen.getByRole('heading', { name: 'Waitlist' })).toBeTruthy()
    expect(screen.getByText('newer@test.com')).toBeTruthy()
    expect(screen.getByText('popup')).toBeTruthy()
    expect(screen.getByText('Total signups')).toBeTruthy()
    expect(waitlistTable.textContent).toContain('older@test.com')
  })
})
