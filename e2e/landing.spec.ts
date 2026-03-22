import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should display current cinematic hero content', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('UNKNOWN CINEMATIC DNA STRAND DETECTED.')
    await expect(page.locator('body')).toContainText('Cine')
    await expect(page.locator('body')).toContainText('Sequence')
  })

  test('should have register and login CTA buttons', async ({ page }) => {
    await page.goto('/')
    const registerLink = page.locator('a[href="/register"]')
    const loginLink = page.locator('a[href="/login"]')
    await expect(registerLink).toBeVisible()
    await expect(loginLink).toBeVisible()
  })

  test('should display five panel titles on desktop layout', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toContainText('Origin')
    await expect(page.locator('body')).toContainText('Sequence')
    await expect(page.locator('body')).toContainText('Decode')
    await expect(page.locator('body')).toContainText('Resonate')
    await expect(page.locator('body')).toContainText('Reveal')
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/register"]')
    await expect(page).toHaveURL('/register')
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/login"]')
    await expect(page).toHaveURL('/login')
  })

  test('should render English content when locale is en and allow toggling locale', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cinesequence-locale', 'en')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).toContainText('movie choices', { timeout: 10000 })

    await page.locator('button[aria-label="切換至中文"]').click()
    await expect(page.locator('body')).toContainText('二十道電影選擇', { timeout: 10000 })

    await page.locator('button[aria-label="Switch to English"]').click()
    await expect(page.locator('body')).toContainText('Twenty movie choices', { timeout: 10000 })
  })
})
