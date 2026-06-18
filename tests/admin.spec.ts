import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://127.0.0.1:3002';

test.describe('Admin Login', () => {
  test('loads admin login page', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    const heading = page.locator('h1:has-text("Admin Dashboard")');
    await expect(heading).toBeVisible();
  });

  test('login form has email and password fields', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    const emailInput = page.locator('input[type="email"]');
    const passInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passInput).toBeVisible();
  });

  test('successful admin login redirects to dashboard', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.locator('input[type="email"]').fill('admin@katanguri.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button:has-text("Sign In")').click();
    // Wait for redirect away from login (up to 10s)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    // Wait for Dashboard KPI card to be visible (ensures client hydration is complete)
    await expect(page.getByText('Revenue Today').first()).toBeVisible({ timeout: 10000 });
    const body = await page.textContent('body');
    expect(body).toContain('Dashboard');
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.locator('input[type="email"]').fill('admin@katanguri.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button:has-text("Sign In")').click();
    // Wait for error message (either "Invalid" from API or catch block error)
    await expect(page.locator('p').filter({ hasText: /invalid|failed|error/i }).first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.locator('input[type="email"]').fill('admin@katanguri.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button:has-text("Sign In")').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    // Wait for Dashboard KPI card to be visible (ensures client hydration is complete)
    await expect(page.getByText('Revenue Today').first()).toBeVisible({ timeout: 10000 });
  });

  test('dashboard loads with stats', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);
  });

  test('navigation links exist', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toContain('Orders');
    expect(body).toContain('Dashboard');
  });
});
