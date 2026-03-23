import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mocks — all vi.fn() instances must be created inside vi.hoisted so
// that they are defined before the vi.mock() factory functions execute.
// ---------------------------------------------------------------------------
const {
  routerReplaceMock,
  addToastMock,
  fetchDnaResultMock,
  fetchProgressMock,
  // Mutable state containers — tests mutate these directly to control what
  // getState() and the hook selector return.
  dnaState,
  sequencingState,
} = vi.hoisted(() => {
  const dnaState = { result: null as null | { archetype: { id: string } } }
  const sequencingState = {
    progress: null as null | {
      completed: boolean
      seed_movie_tmdb_id: number | null
      round_number: number
    },
  }

  return {
    routerReplaceMock: vi.fn(),
    addToastMock: vi.fn(),
    fetchDnaResultMock: vi.fn(async () => {}),
    fetchProgressMock: vi.fn(async () => {}),
    dnaState,
    sequencingState,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}))

vi.mock('@/stores/dnaStore', () => ({
  useDnaStore: Object.assign(
    // Hook call — selector receives state-like object
    (selector: (s: typeof dnaState & { fetchResult: typeof fetchDnaResultMock }) => unknown) =>
      selector({ ...dnaState, fetchResult: fetchDnaResultMock }),
    // Static method used inside FlowGuard
    {
      getState: () => ({ ...dnaState, fetchResult: fetchDnaResultMock }),
    },
  ),
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: Object.assign(
    (
      selector: (
        s: typeof sequencingState & { fetchProgress: typeof fetchProgressMock },
      ) => unknown,
    ) => selector({ ...sequencingState, fetchProgress: fetchProgressMock }),
    {
      getState: () => ({ ...sequencingState, fetchProgress: fetchProgressMock }),
    },
  ),
}))

vi.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (s: { addToast: typeof addToastMock }) => unknown) =>
    selector({ addToast: addToastMock }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

// Import component AFTER all vi.mock calls
import FlowGuard from './FlowGuard'

describe('FlowGuard', () => {
  beforeEach(() => {
    routerReplaceMock.mockReset()
    addToastMock.mockReset()
    fetchDnaResultMock.mockReset()
    fetchProgressMock.mockReset()
    // Reset state containers to safe defaults
    dnaState.result = null
    sequencingState.progress = null
  })

  afterEach(() => {
    cleanup()
  })

  // ---------------------------------------------------------------------------
  // require="dna"
  // ---------------------------------------------------------------------------

  it('renders children when require="dna" and a DNA result exists', async () => {
    dnaState.result = { archetype: { id: 'explorer' } }
    fetchDnaResultMock.mockResolvedValue(undefined)

    render(
      <FlowGuard require="dna">
        <p>Protected content</p>
      </FlowGuard>,
    )

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeTruthy()
    })

    expect(routerReplaceMock).not.toHaveBeenCalled()
  })

  it('redirects to /dna when require="dna" and no DNA result exists', async () => {
    dnaState.result = null
    fetchDnaResultMock.mockResolvedValue(undefined)

    render(
      <FlowGuard require="dna">
        <p>Protected content</p>
      </FlowGuard>,
    )

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith('/dna')
    })

    expect(addToastMock).toHaveBeenCalledWith('info', 'guard.needDna')
    expect(screen.queryByText('Protected content')).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // require="sequencing"
  // ---------------------------------------------------------------------------

  it('renders children when require="sequencing" and sequencing is completed', async () => {
    sequencingState.progress = {
      completed: true,
      seed_movie_tmdb_id: 12,
      round_number: 20,
    }
    fetchProgressMock.mockResolvedValue(undefined)

    render(
      <FlowGuard require="sequencing">
        <p>Sequencing content</p>
      </FlowGuard>,
    )

    await waitFor(() => {
      expect(screen.getByText('Sequencing content')).toBeTruthy()
    })

    expect(routerReplaceMock).not.toHaveBeenCalled()
  })

  it('redirects to /sequencing when require="sequencing" and a seeded session is in progress', async () => {
    sequencingState.progress = {
      completed: false,
      seed_movie_tmdb_id: 42,
      round_number: 12,
    }
    fetchProgressMock.mockResolvedValue(undefined)

    render(
      <FlowGuard require="sequencing">
        <p>Sequencing content</p>
      </FlowGuard>,
    )

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith('/sequencing')
    })

    expect(addToastMock).toHaveBeenCalledWith('info', 'guard.needSequencing')
    expect(screen.queryByText('Sequencing content')).toBeNull()
  })

  it('redirects to /sequencing/seed when require="sequencing" and seed selection is still missing', async () => {
    sequencingState.progress = {
      completed: false,
      seed_movie_tmdb_id: null,
      round_number: 1,
    }
    fetchProgressMock.mockResolvedValue(undefined)

    render(
      <FlowGuard require="sequencing">
        <p>Sequencing content</p>
      </FlowGuard>,
    )

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith('/sequencing/seed')
    })

    expect(addToastMock).toHaveBeenCalledWith('info', 'guard.needSequencing')
    expect(screen.queryByText('Sequencing content')).toBeNull()
  })

  it('shows toast with the guard translation key on redirect', async () => {
    dnaState.result = null
    fetchDnaResultMock.mockResolvedValue(undefined)

    render(
      <FlowGuard require="dna">
        <p>content</p>
      </FlowGuard>,
    )

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledTimes(1)
    })

    const [type, message] = addToastMock.mock.calls[0] as [string, string]
    expect(type).toBe('info')
    expect(typeof message).toBe('string')
    expect(message.length).toBeGreaterThan(0)
  })
})
