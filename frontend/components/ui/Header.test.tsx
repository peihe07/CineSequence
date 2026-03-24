import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { replaceMock, logoutMock, pathnameState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  logoutMock: vi.fn(),
  pathnameState: {
    value: '/dna',
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode
    href: string
    onClick?: () => void
    className?: string
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'nav.main': 'Main navigation',
        'nav.sequencing': 'Sequencing',
        'nav.dna': 'DNA',
        'nav.matches': 'Matches',
        'nav.theaters': 'Theaters',
        'nav.profile': 'Profile',
        'profile.logout': 'Log out',
        'header.openMenu': 'Open menu',
        'header.closeMenu': 'Close menu',
        'header.mobileMenu': 'Mobile menu',
      }
      return dict[key] ?? key
    },
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { logout: typeof logoutMock }) => unknown) =>
    selector({ logout: logoutMock }),
}))

vi.mock('@/lib/sound', () => ({
  soundManager: {
    play: vi.fn(),
  },
}))

vi.mock('./LocaleToggle', () => ({
  default: () => <button type="button">Locale</button>,
}))

vi.mock('./MuteToggle', () => ({
  default: () => <button type="button">Mute</button>,
}))

vi.mock('./NotificationBell', () => ({
  default: () => <button type="button">Notifications</button>,
}))

import Header from './Header'

describe('Header', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    logoutMock.mockReset()
    pathnameState.value = '/dna'
  })

  afterEach(() => {
    cleanup()
  })

  it('toggles the mobile menu and exposes navigation links', () => {
    render(<Header />)

    expect(screen.queryByRole('dialog', { name: 'Mobile menu' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const dialog = screen.getByRole('dialog', { name: 'Mobile menu' })

    expect(dialog).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: '00 Sequencing' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Log out' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.queryByRole('dialog', { name: 'Mobile menu' })).toBeNull()
  })

  it('logs out and redirects to home from the mobile menu', async () => {
    logoutMock.mockResolvedValue(undefined)

    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Mobile menu' })).getByRole('button', {
        name: 'Log out',
      }),
    )

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })
})
