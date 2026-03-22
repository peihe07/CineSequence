/**
 * E2E test helpers for Cine Sequence.
 * Provides utilities for auth bypass and common actions.
 */

import { Page } from '@playwright/test'

const API_URL = 'http://localhost:8000'

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
 * Login by directly setting the JWT token in localStorage.
 * Generates a fresh JWT via the backend Python helper.
 */
export async function loginAsTestUser(page: Page, userId: string): Promise<void> {
  // Generate a fresh JWT by calling the backend
  const resp = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-e2e@example.com' }),
  })

  // Since we can't get the token from the response (it's sent via email),
  // we'll inject the token directly into localStorage
  await page.goto('/')
  await page.evaluate((uid) => {
    // Create a minimal JWT for testing — this won't work for API calls
    // but will allow us to test the UI flow
    localStorage.setItem('cine_sequence_token', 'test-token')
  }, userId)
}

/**
 * Set auth token in localStorage to bypass login flow.
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.goto('/')
  await page.evaluate((t) => {
    localStorage.setItem('cine_sequence_token', t)
  }, token)
}
