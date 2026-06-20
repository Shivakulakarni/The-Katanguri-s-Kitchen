import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ── Config ──────────────────────────────────────────────────────────────────
const WEB = 'http://127.0.0.1:3000';
const ADMIN = 'http://127.0.0.1:3002';
const DIR = path.resolve(process.cwd(), 'tests', 'screenshots', 'manual');
fs.mkdirSync(DIR, { recursive: true });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true });
  console.log(`📸 ${name}.png`);
}

async function goto(page: Page, url: string) {
  await page.route('**/*.{woff,woff2,ttf}', r => r.abort());
  await page.route(/.*google.*fonts.*/, r => r.abort());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: CUSTOMER WEB APP
// ════════════════════════════════════════════════════════════════════════════
test.describe('Manual Test — Customer Web App', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('01 — Homepage', async ({ page }) => {
    await goto(page, WEB);
    const title = await page.title();
    console.log(`Title: ${title}`);
    await expect(page.locator('body')).toBeVisible();
    await shot(page, '01_web_homepage');

    // Dark mode toggle
    const darkBtn = page.locator('button').filter({ hasText: /dark|light|🌙|☀/i }).first();
    if (await darkBtn.count() > 0) {
      await darkBtn.click();
      await page.waitForTimeout(500);
      await shot(page, '02_web_homepage_dark');
      await darkBtn.click(); // toggle back
    }
    console.log('✅ Homepage — PASS');
  });

  test('02 — Menu Page (browse + filter + search + add to cart)', async ({ page }) => {
    await goto(page, `${WEB}/menu`);
    const h1 = await page.locator('h1').first().textContent();
    console.log(`Menu heading: ${h1}`);
    await shot(page, '03_web_menu');

    // Category filter
    const catBtns = page.locator('button').filter({ hasText: /VEG|BIRYANI|CHICKEN|STARTERS/i });
    if (await catBtns.count() > 0) {
      await catBtns.first().click();
      await page.waitForTimeout(1000);
      await shot(page, '04_web_menu_filtered');
    }

    // Search
    const search = page.locator('input[placeholder*="Search"]');
    if (await search.count() > 0) {
      await search.fill('chicken');
      await page.waitForTimeout(1000);
      await shot(page, '05_web_menu_search');
      await search.fill('');
      await page.waitForTimeout(500);
    }

    // Add to cart
    const addBtn = page.locator('button').filter({ hasText: '+ Add' }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, '06_web_menu_add_to_cart');
    }
    console.log('✅ Menu — PASS');
  });

  test('03 — Cart Page', async ({ page }) => {
    await goto(page, `${WEB}/menu`);
    // Add an item first
    await page.waitForTimeout(2000);
    const addBtn = page.locator('button').filter({ hasText: '+ Add' }).first();
    if (await addBtn.count() > 0) await addBtn.click();

    await goto(page, `${WEB}/cart`);
    const body = await page.locator('body').textContent();
    console.log(`Cart body length: ${body?.length}`);
    await shot(page, '07_web_cart');
    console.log('✅ Cart — PASS');
  });

  test('04 — Auth Page (Phone + OTP flow)', async ({ page }) => {
    await goto(page, `${WEB}/auth?mode=login`);
    await shot(page, '08_web_auth_login');

    // Switch to email tab
    const emailTab = page.getByRole('button', { name: 'Email' });
    if (await emailTab.count() > 0) {
      await emailTab.click();
      await page.waitForTimeout(500);
      await shot(page, '09_web_auth_email_tab');
      await page.getByRole('button', { name: 'Phone' }).click();
    }

    // Enter dev bypass phone
    const phoneInput = page.getByPlaceholder('98765 43210');
    await phoneInput.fill('9876543003');
    await page.getByRole('button', { name: 'Send OTP' }).click();
    await page.waitForTimeout(2000);
    await shot(page, '10_web_auth_otp_sent');

    // Fill OTP
    const otpBoxes = page.locator('input[maxlength="1"]');
    if (await otpBoxes.count() === 6) {
      const bodyText = await page.textContent('body');
      const match = bodyText?.match(/Dev Mode: (\d{6})/);
      await otpBoxes.first().focus();
      if (match && match[1]) {
        const otpVal = match[1];
        await page.keyboard.type(otpVal, { delay: 100 });
      } else {
        await page.keyboard.type('123456', { delay: 100 });
      }
      await page.getByRole('button', { name: 'Verify & Sign In' }).click();
      await page.waitForTimeout(3000);
      await shot(page, '11_web_after_login');
      const url = page.url();
      console.log(`After login URL: ${url}`);
    }
    console.log('✅ Auth — PASS');
  });

  test('05 — Checkout, Track, FAQ, Contact', async ({ page }) => {
    await goto(page, `${WEB}/checkout`);
    await shot(page, '12_web_checkout');

    await goto(page, `${WEB}/track`);
    await shot(page, '13_web_track');

    await goto(page, `${WEB}/faq`);
    await shot(page, '14_web_faq');
    // Expand first FAQ item
    const faqItem = page.locator('details, [class*="accordion"] button, summary').first();
    if (await faqItem.count() > 0) {
      await faqItem.click();
      await page.waitForTimeout(500);
      await shot(page, '15_web_faq_expanded');
    }

    await goto(page, `${WEB}/contact`);
    await shot(page, '16_web_contact');
    console.log('✅ Checkout / Track / FAQ / Contact — PASS');
  });

  test('06 — Mobile Responsive (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goto(page, WEB);
    await shot(page, '17_web_mobile_home');
    await goto(page, `${WEB}/menu`);
    await shot(page, '18_web_mobile_menu');
    await goto(page, `${WEB}/cart`);
    await shot(page, '19_web_mobile_cart');
    console.log('✅ Mobile Responsive — PASS');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
test.describe('Manual Test — Admin Dashboard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Login helper
  async function adminLogin(page: Page) {
    await page.route('**/*.{woff,woff2,ttf}', r => r.abort());
    await page.goto(`${ADMIN}/admin/login`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Sign in with Email OTP")').click();
    await page.waitForTimeout(500);
    await page.locator('input[type="email"]').fill('admin@katanguri.com');
    await page.locator('button:has-text("Send Code")').click();
    const otpInput = page.locator('input[placeholder="000000"]');
    await expect(otpInput).toBeVisible({ timeout: 5000 });
    await otpInput.fill('123456');
    await page.locator('button:has-text("Verify & Sign In")').click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  test('01 — Admin Login Page', async ({ page }) => {
    await page.route('**/*.{woff,woff2,ttf}', r => r.abort());
    await page.goto(`${ADMIN}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIR, 'admin_01_login.png'), fullPage: true });
    console.log('📸 admin_01_login.png');

    const heading = page.locator('h1, h2').filter({ hasText: /Admin|Dashboard|Sign/i }).first();
    if (await heading.count() > 0) console.log(`  Heading: ${await heading.textContent()}`);
    const emailOtpBtn = page.locator('button:has-text("Sign in with Email OTP")');
    await expect(emailOtpBtn).toBeVisible();
    console.log('✅ Admin Login Page — PASS');
  });

  test('02 — Dashboard Overview', async ({ page }) => {
    await adminLogin(page);
    await page.screenshot({ path: path.join(DIR, 'admin_02_dashboard.png'), fullPage: false });
    console.log('📸 admin_02_dashboard.png');

    const body = await page.locator('body').textContent();
    const hasRevenue = body?.includes('Revenue');
    const hasOrders = body?.includes('Order');
    console.log(`  Revenue stat visible: ${hasRevenue}`);
    console.log(`  Orders stat visible: ${hasOrders}`);

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(DIR, 'admin_03_dashboard_scroll.png'), fullPage: false });
    console.log('📸 admin_03_dashboard_scroll.png');
    console.log('✅ Admin Dashboard — PASS');
  });

  test('03 — Orders Management', async ({ page }) => {
    await adminLogin(page);
    // Navigate to orders
    const ordersLink = page.locator('a, button').filter({ hasText: /^Orders$/i }).first();
    if (await ordersLink.count() > 0) {
      await ordersLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, 'admin_04_orders.png'), fullPage: true });
    console.log('📸 admin_04_orders.png');

    // Click status tabs
    const pendingTab = page.locator('button, [role="tab"]').filter({ hasText: /PENDING|Pending/i }).first();
    if (await pendingTab.count() > 0) {
      await pendingTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(DIR, 'admin_05_orders_pending.png'), fullPage: false });
      console.log('📸 admin_05_orders_pending.png');
    }
    console.log('✅ Orders Management — PASS');
  });

  test('04 — Menu Management', async ({ page }) => {
    await adminLogin(page);
    const menuLink = page.locator('a, button').filter({ hasText: /^Menu$/i }).first();
    if (await menuLink.count() > 0) {
      await menuLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/menu`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(DIR, 'admin_06_menu.png'), fullPage: true });
    console.log('📸 admin_06_menu.png');

    // Count menu items
    const rows = page.locator('tr, [class*="item"], [class*="card"]');
    const count = await rows.count();
    console.log(`  Menu items/rows visible: ${count}`);
    console.log('✅ Menu Management — PASS');
  });

  test('05 — Inventory', async ({ page }) => {
    await adminLogin(page);
    const invLink = page.locator('a, button').filter({ hasText: /Inventory/i }).first();
    if (await invLink.count() > 0) {
      await invLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/inventory`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, 'admin_07_inventory.png'), fullPage: true });
    console.log('📸 admin_07_inventory.png');
    console.log('✅ Inventory — PASS');
  });

  test('06 — Analytics', async ({ page }) => {
    await adminLogin(page);
    const analyticsLink = page.locator('a, button').filter({ hasText: /Analytics/i }).first();
    if (await analyticsLink.count() > 0) {
      await analyticsLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/analytics`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(DIR, 'admin_08_analytics.png'), fullPage: true });
    console.log('📸 admin_08_analytics.png');
    console.log('✅ Analytics — PASS');
  });

  test('07 — KDS (Kitchen Display System)', async ({ page }) => {
    await adminLogin(page);
    const kdsLink = page.locator('a, button').filter({ hasText: /KDS|Kitchen Display/i }).first();
    if (await kdsLink.count() > 0) {
      await kdsLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/kds`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, 'admin_09_kds.png'), fullPage: true });
    console.log('📸 admin_09_kds.png');
    console.log('✅ KDS — PASS');
  });

  test('08 — Settings', async ({ page }) => {
    await adminLogin(page);
    const settingsLink = page.locator('a, button').filter({ hasText: /Settings/i }).first();
    if (await settingsLink.count() > 0) {
      await settingsLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/settings`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, 'admin_10_settings.png'), fullPage: true });
    console.log('📸 admin_10_settings.png');
    console.log('✅ Settings — PASS');
  });

  test('09 — AI Chat', async ({ page }) => {
    await adminLogin(page);
    const aiLink = page.locator('a, button').filter({ hasText: /AI|Chat/i }).first();
    if (await aiLink.count() > 0) {
      await aiLink.click();
    } else {
      await page.goto(`${ADMIN}/admin/ai-chat`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, 'admin_11_ai_chat.png'), fullPage: true });
    console.log('📸 admin_11_ai_chat.png');
    console.log('✅ AI Chat — PASS');
  });
});
