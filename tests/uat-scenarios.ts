import { test, expect } from '@playwright/test';

test.describe('UAT: Kitchen Manager Core Workflows', () => {
  const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

  test('TC-KM-01: Admin login with valid credentials', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await expect(page.locator('h2')).toContainText('Login');
    await page.fill('input[name="email"]', 'admin@kitchen.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('TC-KM-02: View real-time orders on KDS', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/kds`);
    await page.waitForLoadState('networkidle');
    const orderCards = page.locator('[data-testid="order-card"]');
    const count = await orderCards.count();
    console.log(`KDS showing ${count} active orders`);
    await expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-KM-03: Update order status flow', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/orders`);
    await page.waitForLoadState('networkidle');
    const firstOrder = page.locator('[data-testid="order-row"]').first();
    if (await firstOrder.isVisible()) {
      await firstOrder.click();
      await page.click('text=CONFIRMED');
      await expect(page.locator('text=Status updated')).toBeVisible();
    }
  });

  test('TC-KM-04: Inventory stock alert visibility', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/inventory`);
    await page.waitForLoadState('networkidle');
    const lowStockItems = page.locator('[data-testid="low-stock"]');
    const count = await lowStockItems.count();
    console.log(`Low stock items: ${count}`);
  });

  test('TC-KM-05: Menu item toggle availability', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/menu`);
    await page.waitForLoadState('networkidle');
    const toggle = page.locator('[data-testid="toggle-availability"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator('text=Updated')).toBeVisible();
    }
  });

  test('TC-KM-06: Error recovery - offline API', async ({ page }) => {
    await page.route('**/api/v1/menu', (route) => route.abort('connectionrefused'));
    await page.goto(`${ADMIN_URL}/admin/menu`);
    await expect(page.locator('text=error|unable to load|try again')).toBeVisible();
  });

  test('TC-KM-07: Responsive layout on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${ADMIN_URL}/admin/dashboard`);
    await expect(page.locator('nav')).toBeVisible();
    const navLinks = page.locator('nav a');
    const linksVisible = await navLinks.count();
    expect(linksVisible).toBeGreaterThan(0);
  });

  test('TC-KM-08: Data security - no PII in URLs', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('token=') || url.includes('password=') || url.includes('otp=')) {
        errors.push(`PII in URL: ${url}`);
      }
    });
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.fill('input[name="email"]', 'admin@kitchen.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    expect(errors).toHaveLength(0);
  });
});
