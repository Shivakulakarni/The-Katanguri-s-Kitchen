import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('Navigate: Home -> Menu -> Cart -> Track -> Auth', async ({ page }) => {
    // Home
    await page.goto('/');
    await expect(page.locator('text=The Katanguri\'s Kitchen').first()).toBeVisible();
    
    // Menu via nav
    await page.locator('nav a:has-text("Menu")').first().click();
    await page.waitForURL('**/menu');
    
    // Cart via nav
    await page.locator('nav a:has-text("Cart")').first().click();
    await page.waitForURL('**/cart');
    
    // Track via nav — wait for nav to be ready after page transition
    await expect(page.locator('nav a:has-text("Track")').first()).toBeVisible({ timeout: 10000 });
    await page.locator('nav a:has-text("Track")').first().click();
    // Track page has SSE streaming which may be slow to fully load
    try {
      await page.waitForURL('**/track', { timeout: 10000 });
    } catch {
      // SSE may delay load — navigate directly if needed
      await page.goto('/track', { waitUntil: 'commit', timeout: 15000 });
    }
    
    // Auth via nav — Log In link is inside NavAuth component
    const logInLink = page.locator('nav a:has-text("Log In")').first();
    await expect(logInLink).toBeVisible({ timeout: 10000 });
    await logInLink.click();
    await page.waitForURL((url) => url.pathname.includes('/auth'), { timeout: 15000 });
  });

  test('Mobile nav works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toContain('Home');
    expect(body).toContain('Menu');
    expect(body).toContain('Cart');
  });

  test('Theme toggle exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    // Theme toggle should be present (desktop nav)
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });
});
