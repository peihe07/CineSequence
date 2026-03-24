import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
        'profile.save': 'Save',
        'profile.cancel': 'Cancel',
        'profile.changeAvatar': 'Change avatar',
        'profile.editName': 'Edit name',
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
        'confirm.logout': 'Confirm logout',
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

    expect(screen.getByText('aster@example.com')).toBeTruthy()
    expect(screen.getByText('Dreaming in long takes.')).toBeTruthy()
    expect(screen.getByText('Dream Archive')).toBeTruthy()
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
})
