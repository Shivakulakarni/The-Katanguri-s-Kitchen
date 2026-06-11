/**
 * Mobile Demo Walkthrough Script
 * Records video + screenshots of mobile-responsive views (375x812 iPhone 14)
 */

import { chromium, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '..', 'demo-output', 'mobile');
const WEB_URL = 'http://localhost:3000';
const ADMIN_URL = 'http://localhost:3002/admin';
const ADMIN_EMAIL = 'admin@kitchen.app';
const ADMIN_PASSWORD = 'Admin@Kitchen123';

async function pause(ms: number, label: string) {
  console.log(`  ⏳ [${label}] waiting ${ms}ms...`);
  await new Promise(r => setTimeout(r, ms));
}

async function screenshot(context: BrowserContext, name: string) {
  const page = context.pages()[0];
  if (!page) return;
  const filepath = path.join(OUTPUT_DIR, 'screenshots', `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 Screenshot: ${name}.png`);
}

async function run() {
  fs.mkdirSync(path.join(OUTPUT_DIR, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  const browser = await chromium.launch({ headless: true });

  console.log('\n📱 ========================================');
  console.log('   MOBILE DEMO — iPhone 14 (375x812)');
  console.log('   ========================================\n');

  // ========== CUSTOMER WEB APP ==========
  console.log('📱 Customer Web App — Mobile View\n');

  const mobileWeb = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    recordVideo: { dir: path.join(OUTPUT_DIR, 'videos'), size: { width: 375, height: 812 } },
  });
  const webPage = await mobileWeb.newPage();

  // Homepage
  console.log('1️⃣  Homepage (Mobile)');
  await webPage.goto(WEB_URL, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile homepage loads');
  await screenshot(mobileWeb, 'm01-web-homepage');
  await webPage.evaluate(() => window.scrollBy(0, 400));
  await pause(1500, 'Scroll to stats');
  await screenshot(mobileWeb, 'm02-web-homepage-stats');
  await webPage.evaluate(() => window.scrollBy(0, 600));
  await pause(1500, 'Scroll to dishes');
  await screenshot(mobileWeb, 'm03-web-homepage-dishes');

  // Menu
  console.log('2️⃣  Menu (Mobile)');
  await webPage.goto(`${WEB_URL}/menu`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile menu loads');
  await screenshot(mobileWeb, 'm04-web-menu');

  // Cart
  console.log('3️⃣  Cart (Mobile)');
  await webPage.goto(`${WEB_URL}/cart`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Mobile cart');
  await screenshot(mobileWeb, 'm05-web-cart');

  // Auth
  console.log('4️⃣  Auth (Mobile)');
  await webPage.goto(`${WEB_URL}/auth`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Mobile login');
  await screenshot(mobileWeb, 'm06-web-auth');

  // Track
  console.log('5️⃣  Track (Mobile)');
  await webPage.goto(`${WEB_URL}/track`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Mobile tracking');
  await screenshot(mobileWeb, 'm07-web-track');

  // Save web mobile video
  const webVideo = webPage.video();
  if (webVideo) {
    await webPage.close();
    const vp = await webVideo.path();
    if (vp) fs.copyFileSync(vp, path.join(OUTPUT_DIR, 'videos', 'web-mobile-demo.webm'));
  }
  await mobileWeb.close();

  // ========== ADMIN DASHBOARD ==========
  console.log('\n🖥️  Admin Dashboard — Mobile View\n');

  const mobileAdmin = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    recordVideo: { dir: path.join(OUTPUT_DIR, 'videos'), size: { width: 375, height: 812 } },
  });
  const adminPage = await mobileAdmin.newPage();

  // Admin Login
  console.log('6️⃣  Admin Login (Mobile)');
  await adminPage.goto(`${ADMIN_URL}/login`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Mobile admin login');
  await screenshot(mobileAdmin, 'm08-admin-login');

  // Fill login
  const emailInput = adminPage.locator('input[placeholder*="admin"]');
  const passInput = adminPage.locator('input[placeholder*="***"]');
  if (await emailInput.isVisible()) {
    await emailInput.fill(ADMIN_EMAIL);
    await passInput.fill(ADMIN_PASSWORD);
    await pause(1000, 'Credentials filled');
    await adminPage.click('button:has-text("Sign In")');
    await pause(4000, 'Admin dashboard loads');
  }

  // Dashboard
  console.log('7️⃣  Dashboard (Mobile)');
  await screenshot(mobileAdmin, 'm09-admin-dashboard');

  // KDS
  console.log('8️⃣  KDS (Mobile)');
  await adminPage.goto(`${ADMIN_URL}/kds`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile KDS');
  await screenshot(mobileAdmin, 'm10-admin-kds');

  // Orders
  console.log('9️⃣  Orders (Mobile)');
  await adminPage.goto(`${ADMIN_URL}/orders`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile orders');
  await screenshot(mobileAdmin, 'm11-admin-orders');

  // Menu
  console.log('🔟  Menu (Mobile)');
  await adminPage.goto(`${ADMIN_URL}/menu`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile menu mgmt');
  await screenshot(mobileAdmin, 'm12-admin-menu');

  // Analytics
  console.log('1️⃣1️⃣  Analytics (Mobile)');
  await adminPage.goto(`${ADMIN_URL}/analytics`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile analytics');
  await screenshot(mobileAdmin, 'm13-admin-analytics');

  // Settings
  console.log('1️⃣2️⃣  Settings (Mobile)');
  await adminPage.goto(`${ADMIN_URL}/settings`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Mobile settings');
  await screenshot(mobileAdmin, 'm14-admin-settings');

  // Save admin mobile video
  const adminVideo = adminPage.video();
  if (adminVideo) {
    await adminPage.close();
    const vp = await adminVideo.path();
    if (vp) fs.copyFileSync(vp, path.join(OUTPUT_DIR, 'videos', 'admin-mobile-demo.webm'));
  }
  await mobileAdmin.close();
  await browser.close();

  console.log('\n✅ ========================================');
  console.log('   Mobile Demo Complete!');
  console.log('   ========================================');
  console.log(`\n📁 Output: ${OUTPUT_DIR}`);
  console.log('   📹 videos/web-mobile-demo.webm');
  console.log('   📹 videos/admin-mobile-demo.webm');
  console.log('   📸 screenshots/ (14 mobile screenshots)\n');
}

run().catch(err => { console.error('❌ Mobile demo failed:', err); process.exit(1); });
