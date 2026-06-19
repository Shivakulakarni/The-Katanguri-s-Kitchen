import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://127.0.0.1:3002';

test.describe('Admin Login (Email OTP)', () => {
  test('loads admin login page and shows choices', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    // Should display the application header
    await expect(page.locator('h1:has-text("The Katanguri")').first()).toBeVisible();
    // Should display Continue with Google and Sign in with Email OTP buttons
    await expect(page.locator('button:has-text("Continue with Google")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in with Email OTP")')).toBeVisible();
  });

  test('can enter email and request OTP code', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.locator('button:has-text("Sign in with Email OTP")').click();
    
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('demo@thekatanguriskitchen.com');
    
    const sendButton = page.locator('button:has-text("Send Code")');
    await expect(sendButton).toBeVisible();
    await sendButton.click();
    
    // Should transition to OTP verify step
    const otpInput = page.locator('input[placeholder="000000"]');
    await expect(otpInput).toBeVisible({ timeout: 5000 });
  });

  test('successful admin login with demo OTP redirects to dashboard', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.locator('button:has-text("Sign in with Email OTP")').click();
    await page.locator('input[type="email"]').fill('demo@thekatanguriskitchen.com');
    await page.locator('button:has-text("Send Code")').click();
    
    const otpInput = page.locator('input[placeholder="000000"]');
    await expect(otpInput).toBeVisible({ timeout: 5000 });
    await otpInput.fill('123456');
    
    const verifyButton = page.locator('button:has-text("Verify & Sign In")');
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();
    
    // Wait for redirect to dashboard (away from /login)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    
    // Wait for Dashboard KPI card to be visible (ensures client hydration is complete)
    await expect(page.getByText('Revenue Today').first()).toBeVisible({ timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Dashboard');
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.locator('button:has-text("Sign in with Email OTP")').click();
    await page.locator('input[type="email"]').fill('demo@thekatanguriskitchen.com');
    await page.locator('button:has-text("Send Code")').click();
    const otpInput = page.locator('input[placeholder="000000"]');
    await expect(otpInput).toBeVisible({ timeout: 5000 });
    await otpInput.fill('123456');
    await page.locator('button:has-text("Verify & Sign In")').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await expect(page.getByText('Revenue Today').first()).toBeVisible({ timeout: 15000 });
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
    expect(body).toContain('AI Manager Chat');
  });
});
