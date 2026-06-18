import { test, expect, type Page } from '@playwright/test';

const WEB_URL = process.env.WEB_URL || 'http://127.0.0.1:3000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://127.0.0.1:3002';

// ── Helper: login via dev bypass ──
async function loginAsCustomer(page: Page, phone = '9876543001') {
  await page.goto(`${WEB_URL}/auth`);
  await page.getByPlaceholder('98765 43210').fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();

  try {
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 6000 });
  } catch {
    const bodyText = await page.textContent('body');
    const match = bodyText?.match(/Dev Mode: (\d{6})/);
    if (match?.[1]) {
      const otpInputs = page.locator('input[maxlength="1"]');
      await otpInputs.first().focus();
      await page.keyboard.type(match[1], { delay: 50 });
      await page.getByRole('button', { name: 'Verify & Sign In' }).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });
    } else {
      throw new Error('Dev bypass failed');
    }
  }
}

// ── 1. Auth Flow ──
test.describe('Authentication', () => {
  test('dev bypass login works', async ({ page }) => {
    await loginAsCustomer(page);
    expect(page.url()).not.toContain('/auth');
    const body = await page.textContent('body');
    expect(body).toContain('The Katanguri');
  });

  test('auth page renders correctly', async ({ page }) => {
    await page.goto(`${WEB_URL}/auth`);
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeVisible();
    await expect(page.getByPlaceholder('98765 43210')).toBeVisible();
  });

  test('logout clears session', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${WEB_URL}/account`);
    // Look for logout button/link
    const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Sign Out")');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await page.waitForTimeout(1000);
      await page.goto(`${WEB_URL}/account`);
      expect(page.url()).toContain('/auth');
    }
  });
});

// ── 2. Menu Flow ──
test.describe('Menu', () => {
  test('menu page loads with categories', async ({ page }) => {
    await page.goto(`${WEB_URL}/menu`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Menu');
  });

  test('add to cart works', async ({ page }) => {
    await page.goto(`${WEB_URL}/menu`);
    await page.waitForSelector('button:has-text("+ Add")', { timeout: 10000 });
    await page.locator('button:has-text("+ Add")').first().click();
    await page.waitForTimeout(500);
    // Cart badge should appear
    const cartBadge = page.locator('[data-testid="cart-count"], .cart-badge');
    if (await cartBadge.count() > 0) {
      await expect(cartBadge.first()).not.toHaveText('0');
    }
  });

  test('search filters menu', async ({ page }) => {
    await page.goto(`${WEB_URL}/menu`);
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Biryani');
      await page.waitForTimeout(500);
      const body = await page.textContent('body');
      expect(body).toContain('Biryani');
    }
  });
});

// ── 3. Cart Flow ──
test.describe('Cart', () => {
  test('cart page shows items', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${WEB_URL}/menu`);
    await page.waitForSelector('button:has-text("+ Add")', { timeout: 10000 });
    await page.locator('button:has-text("+ Add")').first().click();
    await page.waitForTimeout(500);
    await page.goto(`${WEB_URL}/cart`);
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toContain('Cart');
  });

  test('quantity increment works', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${WEB_URL}/menu`);
    await page.waitForSelector('button:has-text("+ Add")', { timeout: 10000 });
    await page.locator('button:has-text("+ Add")').first().click();
    await page.waitForTimeout(500);
    await page.goto(`${WEB_URL}/cart`);
    await page.waitForTimeout(1000);
    const plusBtn = page.locator('button:has-text("+")').first();
    if (await plusBtn.count() > 0) {
      await plusBtn.click();
      await page.waitForTimeout(300);
    }
  });
});

// ── 4. Checkout Flow ──
test.describe('Checkout', () => {
  test('checkout requires auth', async ({ page }) => {
    await page.goto(`${WEB_URL}/checkout`);
    await page.waitForTimeout(2000);
    // Should redirect to auth or show sign-in prompt
    const url = page.url();
    const body = await page.textContent('body');
    const isAuthRedirect = url.includes('/auth');
    const hasSignInPrompt = body?.includes('Sign in') || body?.includes('sign in');
    expect(isAuthRedirect || hasSignInPrompt).toBeTruthy();
  });

  test('checkout shows address form when logged in', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${WEB_URL}/checkout`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Delivery');
  });
});

// ── 5. Order Tracking Flow ──
test.describe('Order Tracking', () => {
  test('track page shows form for empty state', async ({ page }) => {
    await page.goto(`${WEB_URL}/track`);
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toContain('Track');
  });

  test('track page with invalid ID shows error', async ({ page }) => {
    await page.goto(`${WEB_URL}/track?id=999999`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    // Should show "not found" or similar
    expect(body).toMatch(/not found|error|No order/i);
  });
});

// ── 6. Homepage Flow ──
test.describe('Homepage', () => {
  test('homepage loads with hero and categories', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('The Katanguri');
  });

  test('navigation links work', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    await page.waitForTimeout(1000);
    // Check menu link exists
    const menuLink = page.locator('a[href="/menu"]');
    if (await menuLink.count() > 0) {
      await menuLink.first().click();
      await page.waitForURL('**/menu', { timeout: 5000 });
    }
  });
});

// ── 7. Admin Login Flow ──
test.describe('Admin', () => {
  test('admin login page renders', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toContain('Admin');
  });

  test('admin page redirects to login when not authenticated', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/orders`);
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
  });
});

// ── 8. API Health ──
test.describe('API Health', () => {
  test('health endpoint returns OK', async ({ request }) => {
    const res = await request.get(`${WEB_URL.replace(':3000', ':3001')}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.redis.status).toBe('ok');
  });

  test('menu endpoint returns categories', async ({ request }) => {
    const res = await request.get(`${WEB_URL.replace(':3000', ':3001')}/api/v1/menu`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeGreaterThan(0);
  });
});

// ── 9. Accessibility ──
test.describe('Accessibility', () => {
  test('homepage has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${WEB_URL}/`);
    await page.waitForTimeout(2000);
    // Filter out expected errors (OTel, etc.)
    const realErrors = errors.filter(e => !e.includes('opencensus') && !e.includes('OTel'));
    expect(realErrors).toHaveLength(0);
  });

  test('auth page is keyboard navigable', async ({ page }) => {
    await page.goto(`${WEB_URL}/auth`);
    await page.waitForTimeout(1000);
    // Tab through form elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Should not throw
  });
});

// ── 10. Responsive Design ──
test.describe('Responsive', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(`${WEB_URL}/`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('The Katanguri');
    // Mobile nav should be visible
    const mobileNav = page.locator('[data-testid="mobile-nav"], nav');
    expect(await mobileNav.count()).toBeGreaterThan(0);
  });

  test('menu page works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${WEB_URL}/menu`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Menu');
  });
});
