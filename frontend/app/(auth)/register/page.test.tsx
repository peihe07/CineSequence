import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock, registerMock, clearErrorMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  registerMock: vi.fn(),
  clearErrorMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    register: registerMock,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    fetchProfile: vi.fn().mockResolvedValue(undefined),
    clearError: clearErrorMock,
  }),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      if (key === 'auth.checkEmailSent' && vars?.email) {
        return `sent:${vars.email}`
      }
      const dict: Record<string, string> = {
        'register.title': 'Create your account',
        'register.subtitle': 'Start your Cine Sequence',
        'auth.emailPlaceholder': 'Enter your email',
        'register.name': 'Display name',
        'register.namePlaceholder': 'What should we call you',
        'register.gender': 'Gender',
        'register.genderMale': 'Male',
        'register.genderFemale': 'Female',
        'register.genderOther': 'Other',
        'register.genderSkip': 'Prefer not to say',
        'register.submit': 'Sign up',
        'auth.invalidEmail': 'Invalid email',
        'register.nameRequired': 'Name is required',
        'register.genderRequired': 'Gender is required',
        'register.consentRequired': 'Consent is required',
        'register.agreePrefix': 'I agree to the',
        'register.privacyLink': 'privacy policy',
        'auth.hasAccount': 'Already have an account?',
        'auth.signIn': 'Sign in',
        'auth.checkEmail': 'Check your inbox',
        'auth.backToLogin': 'Back to login',
        'auth.magicLinkHelp': 'Magic link help',
      }
      return dict[key] ?? key
    },
  }),
}))

import RegisterPage from './page'

function unlockConsent() {
  const policyBox = screen.getByText('privacy.collectTitle').closest('div')
  if (!policyBox) {
    throw new Error('Policy box not found')
  }

  Object.defineProperty(policyBox, 'scrollHeight', {
    configurable: true,
    value: 200,
  })
  Object.defineProperty(policyBox, 'clientHeight', {
    configurable: true,
    value: 100,
  })
  Object.defineProperty(policyBox, 'scrollTop', {
    configurable: true,
    value: 100,
  })

  fireEvent.scroll(policyBox)
}

describe('RegisterPage', () => {
  beforeEach(() => {
    pushMock.mockReset()
    registerMock.mockReset()
    clearErrorMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('requires consent before submitting', async () => {
    render(<RegisterPage />)

    fireEvent.change(await screen.findByLabelText('Enter your email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'User' },
    })
    fireEvent.change(screen.getByLabelText('register.birthYear'), {
      target: { value: '1990' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Male' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(registerMock).not.toHaveBeenCalled()
    expect(await screen.findByText('Consent is required')).toBeTruthy()
  })

  it('submits when consent is checked', async () => {
    registerMock.mockResolvedValue({
      message: 'If this email is eligible, a magic link has been sent.',
    })

    render(<RegisterPage />)

    fireEvent.change(await screen.findByLabelText('Enter your email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'User' },
    })
    fireEvent.change(screen.getByLabelText('register.birthYear'), {
      target: { value: '1990' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Male' }))
    unlockConsent()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: 'User',
        gender: 'male',
        region: 'TW',
        birth_year: 1990,
        agreed_to_terms: true,
        next_path: '/sequencing',
      })
    })
    expect(await screen.findByText('sent:user@example.com')).toBeTruthy()
    expect(screen.getByText('If this email is eligible, a magic link has been sent.')).toBeTruthy()
    expect(screen.getByText('Magic link help')).toBeTruthy()
  })
})
