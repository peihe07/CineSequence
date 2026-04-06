import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

import { useMatchStore, type MatchItem } from '@/stores/matchStore'

const matchFixture: MatchItem = {
  id: 'match-1',
  partner_id: 'user-2',
  partner_name: 'Aster',
  partner_email: null,
  partner_bio: null,
  partner_avatar_url: null,
  partner_archetype: 'dark_poet',
  similarity_score: 0.87,
  candidate_percentile: 92,
  candidate_pool_size: 50,
  shared_tags: ['slowburn', 'darkTone'],
  ice_breakers: ['Both drawn to slow cinema.'],
  status: 'discovered',
  ticket_image_url: null,
  is_recipient: false,
}

describe('matchStore', () => {
  beforeEach(() => {
    apiMock.mockReset()
    useMatchStore.setState({
      matches: [],
      isLoading: false,
      isDiscovering: false,
      error: null,
      hasHydrated: false,
      lastFetchedAt: null,
    })
  })

  it('fetches matches and stores them', async () => {
    apiMock.mockResolvedValue([matchFixture])

    await useMatchStore.getState().fetchMatches()

    expect(apiMock).toHaveBeenCalledWith('/matches')
    expect(useMatchStore.getState().matches).toEqual([matchFixture])
    expect(useMatchStore.getState().isLoading).toBe(false)
  })

  it('sets error when fetchMatches fails', async () => {
    apiMock.mockRejectedValue(new Error('Network error'))

    await useMatchStore.getState().fetchMatches()

    expect(useMatchStore.getState().matches).toEqual([])
    expect(useMatchStore.getState().error).toBe('Network error')
    expect(useMatchStore.getState().isLoading).toBe(false)
  })

  it('keeps existing matches visible during a background refresh', async () => {
    useMatchStore.setState({ matches: [matchFixture], hasHydrated: true, lastFetchedAt: null })
    apiMock.mockResolvedValueOnce([{ ...matchFixture, partner_name: 'Luna' }])

    const pending = useMatchStore.getState().fetchMatches({ background: true })

    expect(useMatchStore.getState().isLoading).toBe(false)
    expect(useMatchStore.getState().matches[0]?.partner_name).toBe('Aster')

    await pending

    expect(useMatchStore.getState().matches[0]?.partner_name).toBe('Luna')
  })

  it('reuses a fresh matches cache without calling the API again', async () => {
    useMatchStore.setState({
      matches: [matchFixture],
      hasHydrated: true,
      lastFetchedAt: Date.now(),
    })

    await useMatchStore.getState().fetchMatches()

    expect(apiMock).not.toHaveBeenCalled()
    expect(useMatchStore.getState().matches).toEqual([matchFixture])
  })

  it('dedupes concurrent fetchMatches calls into one request', async () => {
    let resolveMatches: ((value: MatchItem[]) => void) | null = null
    apiMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveMatches = resolve as (value: MatchItem[]) => void
    }))

    const first = useMatchStore.getState().fetchMatches()
    const second = useMatchStore.getState().fetchMatches()

    expect(apiMock).toHaveBeenCalledTimes(1)

    resolveMatches?.([matchFixture])
    await Promise.all([first, second])

    expect(useMatchStore.getState().matches).toEqual([matchFixture])
    expect(useMatchStore.getState().hasHydrated).toBe(true)
  })

  it('returns a single match by id', async () => {
    apiMock.mockResolvedValue(matchFixture)

    const result = await useMatchStore.getState().fetchMatch('match-1')

    expect(apiMock).toHaveBeenCalledWith('/matches/match-1')
    expect(result).toEqual(matchFixture)
  })

  it('returns null when fetchMatch fails', async () => {
    apiMock.mockRejectedValue(new Error('Not found'))

    const result = await useMatchStore.getState().fetchMatch('match-999')

    expect(result).toBeNull()
  })

  it('merges discovered matches without duplicates', async () => {
    const existing: MatchItem = { ...matchFixture, id: 'match-1' }
    const newMatch: MatchItem = { ...matchFixture, id: 'match-2', partner_name: 'Luna' }
    useMatchStore.setState({ matches: [existing] })

    apiMock.mockResolvedValue([existing, newMatch])

    await useMatchStore.getState().discoverMatches()

    const matches = useMatchStore.getState().matches
    expect(matches).toHaveLength(2)
    expect(matches[0].id).toBe('match-1')
    expect(matches[1].id).toBe('match-2')
    expect(useMatchStore.getState().isDiscovering).toBe(false)
  })

  it('sets error when discoverMatches fails', async () => {
    apiMock.mockRejectedValue(new Error('Discovery failed'))

    await useMatchStore.getState().discoverMatches()

    expect(useMatchStore.getState().isDiscovering).toBe(false)
    expect(useMatchStore.getState().error).toBe('Discovery failed')
  })

  it('updates match status after sending invite', async () => {
    const invited: MatchItem = { ...matchFixture, status: 'invited' }
    useMatchStore.setState({ matches: [matchFixture] })
    apiMock.mockResolvedValue(invited)

    await useMatchStore.getState().sendInvite('match-1')

    expect(apiMock).toHaveBeenCalledWith('/matches/invite', {
      method: 'POST',
      body: JSON.stringify({ match_id: 'match-1' }),
    })
    expect(useMatchStore.getState().matches[0].status).toBe('invited')
  })

  it('sets error when sendInvite fails', async () => {
    useMatchStore.setState({ matches: [matchFixture] })
    apiMock.mockRejectedValue(new Error('Invite failed'))

    await expect(useMatchStore.getState().sendInvite('match-1')).rejects.toThrow('Invite failed')

    expect(useMatchStore.getState().error).toBe('Invite failed')
    expect(useMatchStore.getState().matches[0].status).toBe('discovered')
  })

  it('updates match status after responding to invite (accept)', async () => {
    const accepted: MatchItem = { ...matchFixture, status: 'accepted' }
    useMatchStore.setState({ matches: [matchFixture] })
    apiMock.mockResolvedValue(accepted)

    await useMatchStore.getState().respondToInvite('match-1', true)

    expect(apiMock).toHaveBeenCalledWith('/matches/respond', {
      method: 'POST',
      body: JSON.stringify({ match_id: 'match-1', accept: true }),
    })
    expect(useMatchStore.getState().matches[0].status).toBe('accepted')
  })

  it('updates match status after responding to invite (decline)', async () => {
    const declined: MatchItem = { ...matchFixture, status: 'declined' }
    useMatchStore.setState({ matches: [matchFixture] })
    apiMock.mockResolvedValue(declined)

    await useMatchStore.getState().respondToInvite('match-1', false)

    expect(apiMock).toHaveBeenCalledWith('/matches/respond', {
      method: 'POST',
      body: JSON.stringify({ match_id: 'match-1', accept: false }),
    })
    expect(useMatchStore.getState().matches[0].status).toBe('declined')
  })

  it('sets error when respondToInvite fails', async () => {
    useMatchStore.setState({ matches: [matchFixture] })
    apiMock.mockRejectedValue(new Error('Response failed'))

    await useMatchStore.getState().respondToInvite('match-1', true)

    expect(useMatchStore.getState().error).toBe('Response failed')
    expect(useMatchStore.getState().matches[0].status).toBe('discovered')
  })
})
