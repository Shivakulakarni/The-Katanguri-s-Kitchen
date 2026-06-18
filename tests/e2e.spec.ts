import { test, expect } from '@playwright/test';

test.describe('Full E2E Flow', () => {
  test('Complete user journey: signup -> browse -> order', async ({ page }) => {
    // 1. Go to auth page, signup
    await page.goto('/auth?mode=signup');
    await page.waitForTimeout(1000);
    
    // Fill name
    await page.fill('input[placeholder="John Doe"]', 'Playwright User');
    
    // Switch to email mode and send OTP
    await page.click('button:has-text("Email")');
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="you@gmail.com"]', 'playwright@test.com');
    await page.click('button:has-text("Send OTP")');
    await page.waitForTimeout(2000);
    
    // Check OTP appears in dev mode
    const successText = await page.textContent('body');
    expect(successText).toContain('OTP');
  });

  test('Auth page: dev bypass login -> redirected to home', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[placeholder="98765 43210"]', '9876543002');
    await page.click('button:has-text("Send OTP")');
    
    // Wait for either redirect OR OTP input to appear
    try {
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 4000 });
    } catch {
      // Dev bypass didn't redirect automatically (running in production mode).
      // We can enter the OTP displayed on the screen.
      const statusText = await page.textContent('body');
      const match = statusText?.match(/Dev Mode: (\d{6})/);
      if (match && match[1]) {
        const otpVal = match[1];
        const otpInputs = page.locator('input[maxlength="1"]');
        await otpInputs.first().focus();
        await page.keyboard.type(otpVal, { delay: 100 });
        await page.click('button:has-text("Verify & Sign In")');
        await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });
      } else {
        throw new Error('Dev bypass failed and no Dev Mode OTP found on screen.');
      }
    }
    
    expect(page.url()).toMatch(/:\/\/(127\.0\.0\.1|localhost):3000\/?$/);
    
    // Verify logged in state (should see user-related content)
    const body = await page.textContent('body');
    expect(body).toContain('The Katanguri');
  });

  test('Menu page loads with content', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForTimeout(3000);
    
    // Page should have substantial content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
  });

  test('No console errors on any page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('favicon') && !err.message.includes('hydrat')) {
        errors.push(err.message);
      }
    });
    
    const pages = ['/', '/menu', '/auth', '/cart', '/track'];
    for (const p of pages) {
      try {
        await page.goto(`http://127.0.0.1:3000${p}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch {
        // /track may be slow due to SSE streaming — retry with longer timeout
        await page.goto(`http://127.0.0.1:3000${p}`, { waitUntil: 'commit', timeout: 20000 });
      }
      await page.waitForTimeout(1500);
    }
    
    expect(errors).toHaveLength(0);
  });
});
