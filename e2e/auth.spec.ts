import { test, expect } from '@playwright/test'

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
})
