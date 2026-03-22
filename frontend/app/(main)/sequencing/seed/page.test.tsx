import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  apiMock,
  setSeedMovieMock,
  sequencingState,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  apiMock: vi.fn(),
  setSeedMovieMock: vi.fn(),
  sequencingState: {
    error: null as string | null,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: () => ({
    setSeedMovie: setSeedMovieMock,
    error: sequencingState.error,
  }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'seed.title': 'Choose your starting point',
        'seed.subtitle': 'Pick a calibration movie',
        'seed.placeholder': 'Search movie title...',
        'seed.confirm': 'Start sequencing',
        'seed.skip': 'Skip this step',
      }
      return dict[key] ?? key
    },
  }),
}))

import SeedMoviePage from './page'

describe('SeedMoviePage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    apiMock.mockReset()
    setSeedMovieMock.mockReset()
    sequencingState.error = null
  })

  afterEach(() => {
    cleanup()
  })

  it('does not navigate to sequencing when setting the seed movie fails', async () => {
    apiMock.mockResolvedValue([
      {
        tmdb_id: 101,
        title_en: 'In the Mood for Love',
        title_zh: null,
        poster_url: null,
        year: 2000,
      },
    ])
    sequencingState.error = 'Failed to set seed movie'
    setSeedMovieMock.mockRejectedValue(new Error('Failed to set seed movie'))

    render(<SeedMoviePage />)

    fireEvent.change(screen.getByPlaceholderText('Search movie title...'), {
      target: { value: 'Mood' },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /In the Mood for Love/i })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /In the Mood for Love/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Start sequencing' }))

    await waitFor(() => {
      expect(setSeedMovieMock).toHaveBeenCalledWith(101)
    })
    expect(pushMock).not.toHaveBeenCalledWith('/sequencing')
    expect(await screen.findByText('Failed to set seed movie')).toBeTruthy()
  })
})
