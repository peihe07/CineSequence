import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

// CSS module stub
vi.mock('./OnboardingOverlay.module.css', () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}))

// Import component AFTER all vi.mock calls
import OnboardingOverlay from './OnboardingOverlay'

// The storage key matches the constant defined inside the component
const STORAGE_KEY = 'cinesequence-onboarding-seen'

describe('OnboardingOverlay', () => {
  // Use a fresh in-memory localStorage substitute so tests are isolated
  let localStorageData: Record<string, string> = {}

  const localStorageMock: Storage = {
    getItem: (key: string) => localStorageData[key] ?? null,
    setItem: (key: string, value: string) => {
      localStorageData[key] = value
    },
    removeItem: (key: string) => {
      delete localStorageData[key]
    },
    clear: () => {
      localStorageData = {}
    },
    get length() {
      return Object.keys(localStorageData).length
    },
    key: (index: number) => Object.keys(localStorageData)[index] ?? null,
  }

  beforeEach(() => {
    localStorageData = {}
    vi.stubGlobal('localStorage', localStorageMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('shows the overlay when localStorage has no onboarding key', () => {
    render(<OnboardingOverlay />)

    // The start button and title are rendered when the overlay is visible
    expect(screen.getByRole('button', { name: 'onboarding.start' })).toBeTruthy()
    expect(screen.getByText('onboarding.title')).toBeTruthy()
  })

  it('hides the overlay when localStorage already has the onboarding key', () => {
    localStorageData[STORAGE_KEY] = '1'

    render(<OnboardingOverlay />)

    expect(screen.queryByRole('button', { name: 'onboarding.start' })).toBeNull()
    expect(screen.queryByText('onboarding.title')).toBeNull()
  })

  it('hides the overlay and sets localStorage when the start button is clicked', () => {
    render(<OnboardingOverlay />)

    // Overlay is visible initially
    const startBtn = screen.getByRole('button', { name: 'onboarding.start' })
    expect(startBtn).toBeTruthy()

    fireEvent.click(startBtn)

    // Overlay should be gone from the DOM
    expect(screen.queryByRole('button', { name: 'onboarding.start' })).toBeNull()

    // The seen flag must have been written to localStorage
    expect(localStorageMock.getItem(STORAGE_KEY)).toBe('1')
  })

  it('renders the expected onboarding step labels', () => {
    render(<OnboardingOverlay />)

    expect(screen.getByText('onboarding.step1')).toBeTruthy()
    expect(screen.getByText('onboarding.step2')).toBeTruthy()
    expect(screen.getByText('onboarding.step3')).toBeTruthy()
  })
})
