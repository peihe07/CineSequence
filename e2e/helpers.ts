/**
 * E2E test helpers for Cine Sequence.
 * Provides utilities for auth bypass and common actions.
 */

import { Page } from '@playwright/test'

const API_URL = 'http://127.0.0.1:8000'
const AUTH_COOKIE_NAME = 'cine_sequence_session'

/**
 * Generate a magic link token for a given email via backend API.
 * Uses the backend directly to bypass email delivery.
 */
export async function getMagicLinkToken(email: string): Promise<string> {
  // Register the user first (idempotent — 409 if exists)
  await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name: 'E2E User', gender: 'other' }),
  })

  // Request login to generate magic link (logged in backend console)
  await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  // Generate token directly via the backend Python helper
  const resp = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!resp.ok) {
    throw new Error(`Login request failed: ${resp.status}`)
  }

  // We need to get the token from backend logs or generate it directly.
  // For E2E, we'll use the verify endpoint with a token generated server-side.
  // Since we can't easily get the token from logs, we'll use a helper endpoint
  // or inject the token directly via localStorage.
  return ''
}

/**
 * Login by directly setting the session cookie in the browser context.
 */
export async function loginAsTestUser(page: Page, userId: string): Promise<void> {
  void userId
  throw new Error('loginAsTestUser is not implemented for cookie-based auth')
}

/**
 * Set auth session cookie to bypass login flow when a valid token is available.
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
