import { test, expect } from '@playwright/test'
import { getMagicLinkToken, loginAsTestUser } from './helpers'

test.describe('Auth Pages', () => {
  test('login page should render with email input', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('register page should render with form fields', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    // Name input
    const nameInput = page.locator('input[name="name"], input[placeholder*="稱呼"], input[placeholder*="call"]')
    await expect(nameInput).toBeVisible()
  })

  test('login with invalid email should show error', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill('not-an-email')
    // Try to submit
    const submitBtn = page.locator('button[type="submit"]')
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      // Should not navigate away
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('register page should have link to login', async ({ page }) => {
    await page.goto('/register')
    const loginLink = page.locator('a[href="/login"]')
    await expect(loginLink).toBeVisible()
  })

  test('login page should have link to register', async ({ page }) => {
    await page.goto('/login')
    const registerLink = page.locator('a[href="/register"]')
    await expect(registerLink).toBeVisible()
  })

  test('existing user can complete magic-link login flow and reach protected app', async ({ page }) => {
    const userId = 'magic-link-bootstrap'
    const email = `test-e2e-${userId}@example.com`

    await loginAsTestUser(page, userId)
    await page.context().clearCookies()

    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('body')).toContainText(email, { timeout: 10000 })

    const token = await getMagicLinkToken(email)
    await page.goto(`/verify?token=${encodeURIComponent(token)}`)

    await page.waitForURL(/\/sequencing(\/seed)?$/, { timeout: 15000 })
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('new user can register, verify magic link, and reach protected app', async ({ page }) => {
    const email = `test-e2e-register-${Date.now()}@example.com`

    await page.goto('/register')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input').nth(1).fill('E2E Register User')
    await page.locator('button[type="button"]').first().click()
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('body')).toContainText(email, { timeout: 10000 })

    const token = await getMagicLinkToken(email)
    await page.goto(`/verify?token=${encodeURIComponent(token)}`)

    await page.waitForURL(/\/sequencing(\/seed)?$/, { timeout: 15000 })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
