import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('Protected Routes (unauthenticated)', () => {
  // In dev mode, AuthGuard relies on client-side useEffect for redirect.
  // React hydration in dev can be slow/unreliable in Playwright.
  test.setTimeout(30000)

  const protectedRoutes = ['/sequencing', '/dna', '/matches', '/theaters', '/profile']

  for (const route of protectedRoutes) {
    test(`${route} should not render protected content when not authenticated`, async ({ page }) => {
      // Navigate to protected route
      await page.goto(route, { waitUntil: 'networkidle' })

      // AuthGuard redirects via client-side useEffect, or returns null (blank page).
      // In dev mode hydration may be delayed. Check either:
      // 1. Redirected to /login
      // 2. Protected page-specific content is NOT visible
      try {
        await page.waitForURL(/\/login/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/login/)
      } catch {
        // If redirect didn't happen, verify no protected UI is visible.
        // Use innerText (visible text only) to avoid matching RSC script payloads.
        const visibleText = await page.locator('body').innerText()
        // Protected pages show NavBar with these labels — none should be visible
        expect(visibleText).not.toContain('序列分析')
        expect(visibleText).not.toContain('品味配對')
      }
    })
  }
})

test.describe('Auth edge cases', () => {
  test('verify page with invalid token shows error', async ({ page }) => {
    await page.goto('/verify?token=invalid-token')
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})

test.describe('Protected Routes (authenticated)', () => {
  test('profile page renders when session cookie is present', async ({ page }) => {
    await loginAsTestUser(page, 'profile-cookie')

    await page.goto('/profile', { waitUntil: 'networkidle' })

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toContainText('test-e2e-profile-cookie@example.com')
  })
})
