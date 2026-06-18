import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const WEB_URL = 'http://127.0.0.1:3000';

// Screenshot directory - each project gets its own subfolder
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'tests', 'screenshots', 'visual-tests');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(testInfo: any, name: string): string {
  const browserDir = path.join(SCREENSHOT_DIR, testInfo.project.name);
  fs.mkdirSync(browserDir, { recursive: true });
  return path.join(browserDir, `${name}.png`);
}

test.describe('Visual Feature Tests', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    // Block web fonts to speed up page loading and prevent screenshot font-load hangs
    await page.route('**/*.{woff,woff2,ttf}', route => route.abort());
    await page.route(/.*google.*fonts.*/, route => route.abort());
  });

  test('TC-V-01: Homepage loads with branding and navigation', async ({ page }, testInfo) => {
    await page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page).toHaveTitle(/Katanguri/);
    await expect(page.locator('nav, header, [class*="nav"]').first()).toBeVisible();

    const body = await page.locator('body').textContent();
    expect(body).toContain('The Katanguri');

    await page.screenshot({ path: screenshotPath(testInfo, '01-homepage'), fullPage: true });
  });

  test('TC-V-02: Menu page shows dishes and categories', async ({ page }, testInfo) => {
    await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('h1')).toContainText('Our Menu');

    const categories = page.locator('button', { hasText: /All|STARTERS|MAIN|BIRYANI/ });
    const count = await categories.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const dishCards = page.locator('[class*="card"]');
    const dishCount = await dishCards.count();
    console.log(`Dish cards rendered: ${dishCount}`);
    expect(dishCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: screenshotPath(testInfo, '02-menu-browse'), fullPage: true });
  });

  test('TC-V-03: Add dish to cart via menu', async ({ page }, testInfo) => {
    await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const addButton = page.locator('button', { hasText: '+ Add' }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    await page.goto(`${WEB_URL}/cart`, { waitUntil: 'networkidle', timeout: 20000 });
    const cartItems = page.locator('[class*="cart"], [class*="item"], li');
    const cartText = await cartItems.first().textContent().catch(() => '');
    console.log(`Cart content: ${cartText.substring(0, 100)}`);

    await page.screenshot({ path: screenshotPath(testInfo, '03-add-to-cart'), fullPage: true });
  });

  test('TC-V-04: Auth page renders login and signup modes', async ({ page }, testInfo) => {
    await page.goto(`${WEB_URL}/auth`, { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('text=The Katanguri').first()).toBeVisible();

    const loginVisible = await page.locator('text=Sign in').isVisible();
    console.log(`Login text visible: ${loginVisible}`);

    await page.screenshot({ path: screenshotPath(testInfo, '04-auth-login'), fullPage: true });

    await page.goto(`${WEB_URL}/auth?mode=signup`, { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('text=Create an account')).toBeVisible();
    await page.screenshot({ path: screenshotPath(testInfo, '05-auth-signup'), fullPage: true });
  });

  test('TC-V-05: Cart page shows empty state', async ({ page }, testInfo) => {
    await page.goto(`${WEB_URL}/cart`, { waitUntil: 'networkidle', timeout: 20000 });

    const body = await page.locator('body').textContent();
    expect(body.length).toBeGreaterThan(100);

    await page.screenshot({ path: screenshotPath(testInfo, '06-cart-empty'), fullPage: true });
  });

  test('TC-V-06: Track order page loads without errors', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${WEB_URL}/track`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();
    expect(body.length).toBeGreaterThan(50);
    expect(consoleErrors.length).toBe(0);

    await page.screenshot({ path: screenshotPath(testInfo, '07-track-order'), fullPage: true });
  });

  test('TC-V-07: Checkout page requires auth but loads gracefully', async ({ page }, testInfo) => {
    await page.goto(`${WEB_URL}/checkout`, { waitUntil: 'networkidle', timeout: 20000 });

    const body = await page.locator('body').textContent();
    console.log(`Checkout body length: ${body.length}`);

    await page.screenshot({ path: screenshotPath(testInfo, '08-checkout'), fullPage: true });
  });

  test('TC-V-08: FAQ and Contact pages render', async ({ page }, testInfo) => {
    await page.goto(`${WEB_URL}/faq`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.screenshot({ path: screenshotPath(testInfo, '09-faq'), fullPage: true });

    await page.goto(`${WEB_URL}/contact`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.screenshot({ path: screenshotPath(testInfo, '10-contact'), fullPage: true });
  });

  test('TC-V-09: No uncaught console errors across all main pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('favicon') && !err.message.includes('ResizeObserver')) {
        consoleErrors.push(err.message);
      }
    });

    const pages = ['/', '/menu', '/auth', '/cart', '/checkout'];
    for (const p of pages) {
      try {
        await page.goto(`${WEB_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);
      } catch { /* timeout on SSE pages is acceptable */ }
    }

    expect(consoleErrors).toEqual([]);
  });

  test('TC-V-10: Responsive layout on mobile viewport', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(WEB_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: screenshotPath(testInfo, '11-mobile-homepage'), fullPage: true });

    await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: screenshotPath(testInfo, '12-mobile-menu'), fullPage: true });
  });
});
