/**
 * E2E test helpers for Cine Sequence.
 * Provides utilities for auth bypass and common actions.
 */

import { Page } from '@playwright/test'

const API_URL = 'http://127.0.0.1:8000'
const AUTH_COOKIE_NAME = 'cine_sequence_session'

export async function getMagicLinkToken(email: string): Promise<string> {
  const resp = await fetch(`${API_URL}/auth/dev/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!resp.ok) {
    throw new Error(`Magic link lookup failed: ${resp.status}`)
  }

  const data = (await resp.json()) as { token: string }
  return data.token
}

/**
 * Login by creating a dev session server-side and injecting the same cookie
 * into the Playwright browser context.
 */
export async function loginAsTestUser(page: Page, userId: string): Promise<void> {
  const email = `test-e2e-${userId}@example.com`
  const resp = await fetch(`${API_URL}/auth/dev/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name: 'E2E User',
      gender: 'other',
      region: 'TW',
    }),
  })

  if (!resp.ok) {
    throw new Error(`Dev session request failed: ${resp.status}`)
  }

  const data = (await resp.json()) as { access_token: string }
  await setAuthToken(page, data.access_token)
}

/**
 * Set auth session cookie to bypass the interactive magic-link flow in E2E.
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}
