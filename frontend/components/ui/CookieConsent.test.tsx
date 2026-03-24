import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'cookie.message': 'Cookie message',
        'cookie.accept': 'Accept',
      }
      return dict[key] ?? key
    },
  }),
}))

import CookieConsent from './CookieConsent'

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.classList.remove('cookieConsentVisible')
  })

  afterEach(() => {
    cleanup()
    document.body.classList.remove('cookieConsentVisible')
  })

  it('adds bottom-safe body spacing while the banner is visible', async () => {
    render(<CookieConsent />)

    await waitFor(() => {
      expect(screen.getByRole('banner', { name: 'Cookie message' })).toBeTruthy()
      expect(document.body.classList.contains('cookieConsentVisible')).toBe(true)
    })
  })

  it('removes the body spacing after acceptance', async () => {
    render(<CookieConsent />)

    const acceptButton = await screen.findByRole('button', { name: 'Accept' })
    fireEvent.click(acceptButton)

    await waitFor(() => {
      expect(screen.queryByRole('banner', { name: 'Cookie message' })).toBeNull()
      expect(document.body.classList.contains('cookieConsentVisible')).toBe(false)
    })
  })
})
