import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { replaceMock, onCloseMock, authState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  onCloseMock: vi.fn(),
  authState: {
    isAuthenticated: false,
  },
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    onClick?: () => void
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'auth.modalLabel': 'Login modal',
        'register.title': 'Register',
        'auth.signIn': 'Sign in',
        'auth.signUp': 'Sign up',
        'auth.modalHeadline': 'Resume the sequence.',
        'auth.layoutHeadline': 'Build your file.',
        'auth.modalCopy': 'Login copy',
        'auth.layoutCopy': 'Register copy',
        'auth.modalStatus': 'Magic Link',
        'auth.layoutStatus': 'File Seed',
        'auth.modalPath': 'ROOT > ACCESS > LOGIN',
        'auth.layoutPath': 'ROOT > ACCESS > REGISTER',
        'auth.modalTimecode': 'TC',
        'auth.layoutTimecode': 'TC',
        'auth.modalRuleTitle': 'Rule',
        'auth.layoutRuleTitle': 'Rule',
        'auth.modalRuleBody': 'Body',
        'auth.layoutRuleBody': 'Body',
        'auth.modalNoAccountTitle': 'No account',
        'auth.layoutGateTitle': 'Gate',
        'auth.modalNoAccountPrefix': 'Go to',
        'auth.modalNoAccountSuffix': '.',
        'auth.modalClose': 'Close login modal',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: authState.isAuthenticated,
  }),
}))

vi.mock('./LoginForm', () => ({
  default: () => <div>Login form</div>,
}))

vi.mock('./RegisterForm', () => ({
  default: () => <div>Register form</div>,
}))

vi.mock('./LoginModal.module.css', () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}))

import LoginModal from './LoginModal'

describe('LoginModal', () => {
  beforeEach(() => {
    cleanup()
    replaceMock.mockReset()
    onCloseMock.mockReset()
    authState.isAuthenticated = false
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the dialog immediately when open is true', () => {
    render(<LoginModal open={true} onClose={onCloseMock} />)

    expect(screen.getByRole('dialog', { name: 'Login modal' })).toBeTruthy()
    expect(screen.getByText('Login form')).toBeTruthy()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('redirects authenticated users without rendering the login form', () => {
    authState.isAuthenticated = true

    render(<LoginModal open={true} onClose={onCloseMock} nextPath="/dna" />)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith('/dna')
  })
})
