import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { replaceMock, logoutMock, apiMock, apiUploadMock, ApiErrorMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  logoutMock: vi.fn(),
  apiMock: vi.fn(),
  apiUploadMock: vi.fn(),
  ApiErrorMock: class ApiError extends Error {
    status: number
    detail: string

    constructor(status: number, detail: string) {
      super(detail)
      this.status = status
      this.detail = detail
    }
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('@/lib/api', () => ({
  ApiError: ApiErrorMock,
  api: apiMock,
  apiUpload: apiUploadMock,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { logout: typeof logoutMock }) => unknown) => {
    const state = { logout: logoutMock }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'profile.title': 'Profile',
        'profile.logout': 'Logout',
        'profile.loggingOut': 'Logging out...',
        'profile.name': 'Name',
        'profile.email': 'Email',
        'profile.gender': 'Gender',
        'profile.birthYear': 'Birth year',
        'profile.region': 'Region',
        'profile.bio': 'Bio',
        'profile.bioEmpty': 'Add a short introduction',
        'profile.bioEmptyDisplay': 'Record pending / no introduction on file',
        'profile.editBio': 'Edit bio',
        'profile.save': 'Save',
        'profile.cancel': 'Cancel',
        'profile.changeAvatar': 'Change avatar',
        'profile.avatarHint': 'Upload a portrait',
        'profile.editName': 'Edit name',
        'profile.edit': 'Edit',
        'profile.matchPref': 'Match Preferences',
        'profile.lookingFor': 'Looking for',
        'profile.ageRange': 'Age range',
        'profile.pureTaste': 'Pure taste',
        'profile.notSet': 'Not set',
        'profile.yes': 'Yes',
        'profile.no': 'No',
        'profile.seqStatus': 'Sequencing',
        'profile.archetype': 'Archetype',
        'profile.genderMale': 'Male',
        'profile.genderFemale': 'Female',
        'profile.genderOther': 'Other',
        'profile.genderSkip': 'Prefer not to say',
        'profile.prefAny': 'Any',
        'profile.notStarted': 'Not started',
        'profile.inProgress': 'In progress',
        'profile.completed': 'Completed',
        'profile.loadError': 'Could not load profile',
        'profile.deck': 'Profile deck copy',
        'profile.featuredNoteLabel': 'Featured Note',
        'profile.identityNotesLabel': 'Identity Notes',
        'profile.identityNotesDeck': 'Identity deck',
        'profile.matchingNotesLabel': 'Matching Notes',
        'profile.matchingNotesDeck': 'Matching deck',
        'profile.preferencesEditorIntro': 'Preferences editor intro',
        'profile.preferencesSummaryIntro': 'Preferences summary intro',
        'profile.pureTasteOnCopy': 'Taste-first is on',
        'profile.pureTasteOffCopy': 'Taste-first is off',
        'profile.favorites': 'Must-Watch Films',
        'profile.favoritesHint': 'Pick up to 3 films that define you for the public dossier.',
        'profile.favoritesEmpty': 'Curation pending / no must-watch films on file',
        'profile.favoritesSearch': 'Search movies...',
        'profile.favoritesSearching': 'Searching...',
        'profile.archiveChip': 'Archive / Profile',
        'profile.dossierLabel': 'Profile Dossier',
        'profile.editionLabel': 'Edition 07',
        'profile.emailNotif': 'Email notifications',
        'profile.visible': 'Visible in pool',
        'profile.editPref': 'Edit preferences',
        'profile.ticketInsertLabel': 'Editorial Insert',
        'profile.ticketIssueLabel': 'Profile Card',
        'profile.ticketCatalogLabel': 'ARCHIVE 07',
        'profile.ticketTasteLabel': 'Taste DNA',
        'profile.ticketFavoritesLabel': 'Must-Watch Films',
        'profile.ticketStyleFallback': 'CLASSIC',
        'profile.snapshotAriaLabel': 'DNA snapshot',
        'profile.snapshotEyebrow': '[ DNA SNAPSHOT ]',
        'profile.snapshotTitle': 'Preference Matrix',
        'profile.snapshotVerified': 'Verified',
        'profile.snapshotArchetype': 'Archetype',
        'profile.snapshotScanComplete': 'Scan complete',
        'profile.snapshotScanning': 'Scanning...',
        'profile.snapshotResolving': 'Resolving profile signature',
        'profile.snapshotPending': 'Pending sequence',
        'profile.snapshotReadiness': 'Sequence readiness',
        'profile.snapshotMatchScope': 'Match scope',
        'profile.snapshotCurationStrictness': 'Curation strictness',
        'profile.sequencingIntro': 'Sequencing intro',
        'profile.previewMode': 'Preview mode',
        'profile.previewBack': 'Back to editing',
        'profile.completeness': 'Completeness',
        'profile.deleteAccount': 'Delete account',
        'profile.deletingAccount': 'Deleting account...',
        'confirm.logout': 'Confirm logout',
        'confirm.deleteAccount': 'Confirm account deletion',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
      }
      return dict[key] ?? key
    },
  }),
}))

import ProfilePage from './page'

describe('ProfilePage', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    logoutMock.mockReset()
    apiMock.mockReset()
    apiUploadMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the loaded profile in the section layout', async () => {
    apiMock.mockResolvedValue({
      name: 'Aster',
      email: 'aster@example.com',
      bio: 'Dreaming in long takes.',
      gender: 'female',
      region: 'TW',
      birth_year: 1996,
      avatar_url: null,
      match_gender_pref: 'male',
      match_age_min: 25,
      match_age_max: 35,
      pure_taste_match: false,
      sequencing_status: 'completed',
      archetype_id: 'dream-archive',
      archetype_name: 'Dream Archive',
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy()
    })

    expect(screen.getAllByText('aster@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dreaming in long takes.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dream Archive').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
  })

  it('logs out and redirects to login when the profile request is unauthorized', async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(401, 'Unauthorized'))

    render(<ProfilePage />)

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith('/login')
    })
  })

  it('deletes the account, logs out, and redirects to login after confirmation', async () => {
    logoutMock.mockResolvedValue(undefined)
    const profileResponse = {
      name: 'Aster',
      email: 'aster@example.com',
      bio: 'Dreaming in long takes.',
      gender: 'female',
      region: 'TW',
      birth_year: 1996,
      avatar_url: null,
      match_gender_pref: 'male',
      match_age_min: 25,
      match_age_max: 35,
      pure_taste_match: false,
      sequencing_status: 'completed',
      archetype_id: 'dream-archive',
      archetype_name: 'Dream Archive',
    }
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/profile' && options?.method === 'DELETE') {
        return Promise.resolve(undefined)
      }
      if (path === '/profile') {
        return Promise.resolve(profileResponse)
      }
      return Promise.reject(new Error(`Unexpected api call: ${path}`))
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/profile', { method: 'DELETE' })
      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith('/login')
    })
  })

  it('hides private editing controls in preview mode', async () => {
    apiMock.mockResolvedValue({
      name: 'Aster',
      email: 'aster@example.com',
      bio: 'Dreaming in long takes.',
      gender: 'female',
      region: 'TW',
      birth_year: 1996,
      avatar_url: null,
      match_gender_pref: 'male',
      match_age_min: 25,
      match_age_max: 35,
      pure_taste_match: false,
      sequencing_status: 'completed',
      archetype_id: 'dream-archive',
      archetype_name: 'Dream Archive',
      is_visible: true,
      email_notifications_enabled: true,
      favorite_movies: [],
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview mode' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Preview mode' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull()
      expect(screen.queryByText('Completeness')).toBeNull()
      expect(screen.queryByLabelText('Edit name')).toBeNull()
    })
  })
})
