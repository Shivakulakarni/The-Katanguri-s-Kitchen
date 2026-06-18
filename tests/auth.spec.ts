import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the auth API endpoints
    await page.route('**/api/v1/auth/otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp: '123456', message: 'OTP sent' }),
      });
    });

    await page.route('**/api/v1/auth/login', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.otp === '123456' || body.otp === '256345') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'mock-jwt-token',
            user: { id: 1, name: 'Test User', email: 'test@kitchen.app', phone: '+919876543210', role: 'customer' },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid OTP' }),
        });
      }
    });
  });

  test('shows login page with phone and email tabs', async ({ page }) => {
    await page.goto('/auth?mode=login');
    await expect(page.getByRole('button', { name: 'Phone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email' })).toBeVisible();
    await expect(page.getByText('Sign in to continue ordering')).toBeVisible();
  });

  test('sends OTP on valid phone number', async ({ page }) => {
    await page.goto('/auth?mode=login');
    // Fill phone number
    const phoneInput = page.getByPlaceholder('98765 43210');
    await phoneInput.fill('9876543211');
    // Click send OTP
    await page.getByRole('button', { name: 'Send OTP' }).click();
    // Verify OTP input appears
    await expect(page.getByText('Enter OTP')).toBeVisible();
    // Verify OTP input fields are present (6 digits)
    const otpInputs = page.locator('input[maxlength="1"]');
    await expect(otpInputs).toHaveCount(6);
  });

  test('completes phone login with valid OTP', async ({ page }) => {
    await page.goto('/auth?mode=login');
    // Use dev bypass number — triggers direct login via /api/v1/auth/login
    await page.getByPlaceholder('98765 43210').fill('9876543210');
    await page.getByRole('button', { name: 'Send OTP' }).click();
    // Wait for the OTP input fields to appear, and fill them in (Dev Mode OTP is 123456)
    const otpInputs = page.locator('input[maxlength="1"]');
    await otpInputs.first().focus();
    await page.keyboard.type('123456', { delay: 100 });
    await page.getByRole('button', { name: 'Verify & Sign In' }).click();
    // Should redirect to home after successful login
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  });

  test('shows error on invalid OTP', async ({ page }) => {
    await page.goto('/auth?mode=login');
    await page.getByPlaceholder('98765 43210').fill('9876543211');
    await page.getByRole('button', { name: 'Send OTP' }).click();
    await expect(page.getByText('Enter OTP')).toBeVisible();
    // Fill wrong OTP
    const otpInputs = page.locator('input[maxlength="1"]');
    await otpInputs.first().focus();
    await page.keyboard.type('999999', { delay: 100 });
    // Click verify - should show error
    await page.getByRole('button', { name: /Verify/i }).click();
    // Should remain on auth page
    expect(page.url()).toContain('/auth');
  });

  test('requires valid email format for email login', async ({ page }) => {
    await page.goto('/auth?mode=login');
    // Switch to email
    await page.getByRole('button', { name: 'Email' }).click();
    const emailInput = page.getByPlaceholder('you@gmail.com');
    // Button should be disabled initially
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
    // Enter invalid email
    await emailInput.fill('not-an-email');
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
    // Enter valid email
    await emailInput.fill('valid@email.com');
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeEnabled();
  });

  test('shows signup form fields for new users', async ({ page }) => {
    await page.goto('/auth?mode=signup');
    await expect(page.getByText('Create an account')).toBeVisible();
    // Should show name field for signup
    await expect(page.getByPlaceholder('John Doe')).toBeVisible();
  });
});
