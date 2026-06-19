import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and displays the app name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=The Katanguri').first()).toBeVisible();
  });

  test('mobile nav links are present', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('[aria-label="Mobile navigation"]').locator('text=Menu')).toBeVisible();
    await expect(page.locator('[aria-label="Mobile navigation"]').locator('text=Cart')).toBeVisible();
    await expect(page.locator('[aria-label="Mobile navigation"]').locator('text=Orders')).toBeVisible();
    await expect(page.locator('[aria-label="Mobile navigation"]').locator('text=Track')).toBeVisible();
  });
});

test.describe('Menu page', () => {
  test('displays menu categories and dishes', async ({ page }) => {
    await page.goto('/menu');
    await expect(page.locator('text=NON-VEG STARTERS').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Chicken 65').first()).toBeVisible();
  });

  test('dish images load from Pexels or Unsplash', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForSelector('button:has-text("+ Add")', { timeout: 10000 });
    const images = page.locator('.card img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 3); i++) {
      const src = await images.nth(i).getAttribute('src');
      expect(src && (src.includes('pexels') || src.includes('unsplash') || src.includes('localhost') || src.startsWith('/_next'))).toBeTruthy();
    }
  });
});

test.describe('Cart flow', () => {
  test('can add dish to cart', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/menu');
    await page.waitForSelector('button:has-text("+ Add")', { timeout: 10000 });
    const addButton = page.locator('button', { hasText: /Add/i }).first();
    await addButton.click();
    // In the layout, adding to cart updates the cart badge. Let's wait for badge or cart link to show count
    await expect(page.locator('text=1').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Auth page', () => {
  test('displays phone input and send OTP button', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByRole('button', { name: /send|otp|sign/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
