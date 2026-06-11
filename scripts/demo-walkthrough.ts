/**
 * Comprehensive Demo Walkthrough Script
 * Records video + screenshots of every feature in both apps
 * 
 * Run with: npx tsx scripts/demo-walkthrough.ts
 * Output: demo-output/ folder with videos, screenshots, and narration script
 */

import { chromium, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '..', 'demo-output');
const WEB_URL = 'http://localhost:3000';
const ADMIN_URL = 'http://localhost:3002/admin';
const ADMIN_EMAIL = 'admin@kitchen.app';
const ADMIN_PASSWORD = 'Admin@Kitchen123';

// Utility: wait + log for narration timing
async function pause(ms: number, label: string) {
  console.log(`  ⏳ [${label}] waiting ${ms}ms...`);
  await new Promise(r => setTimeout(r, ms));
}

// Utility: take a named screenshot
async function screenshot(context: BrowserContext, name: string) {
  const page = context.pages()[0];
  if (!page) return;
  const filepath = path.join(OUTPUT_DIR, 'screenshots', `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 Screenshot: ${name}.png`);
}

async function run() {
  // Ensure output directories exist
  fs.mkdirSync(path.join(OUTPUT_DIR, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  const browser = await chromium.launch({ headless: true });

  console.log('\n🎬 ========================================');
  console.log('   THE KATANGURI\'S KITCHEN — Demo Walkthrough');
  console.log('   ========================================\n');

  // ========== PART 1: CUSTOMER WEB APP ==========
  console.log('📱 PART 1: Customer Web App (localhost:3000)\n');

  const webContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.join(OUTPUT_DIR, 'videos'), size: { width: 1440, height: 900 } },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const webPage = await webContext.newPage();

  const pages = [
    { name: 'Homepage', url: WEB_URL, screenshots: [
      { label: 'hero', wait: 3000 },
      { label: 'stats', scroll: 400, wait: 2000 },
      { label: 'categories', scroll: 400, wait: 2000 },
      { label: 'dishes', scroll: 500, wait: 2000 },
      { label: 'how-it-works', scroll: 500, wait: 2000 },
      { label: 'cta', scroll: 500, wait: 2000 },
    ]},
  ];

  // Navigate each page with error recovery
  for (const pg of pages) {
    try {
      console.log(`\n1️⃣  ${pg.name}`);
      await webPage.goto(pg.url, { waitUntil: 'load', timeout: 60000 });
      for (let i = 0; i < pg.screenshots.length; i++) {
        const s = pg.screenshots[i];
        if (s.scroll) await webPage.evaluate((px: number) => window.scrollBy(0, px), s.scroll);
        await pause(s.wait, `${pg.name} ${s.label}`);
        const num = String(i + 1).padStart(2, '0');
        await screenshot(webContext, `${num}-web-homepage-${s.label}`);
      }
    } catch (err) { console.log(`  ⚠️  Skipped ${pg.name}: ${(err as Error).message?.slice(0, 80)}`); }
  }
  
  // 2. Menu Page
  console.log('2️⃣  Menu Page');
  await webPage.goto(`${WEB_URL}/menu`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Menu loads with dishes');
  await screenshot(webContext, '07-web-menu-full');
  
  // Search functionality
  const searchInput = webPage.locator('input[placeholder="Search dishes..."]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('biryani');
    await pause(1500, 'Search filters to biryani');
    await screenshot(webContext, '08-web-menu-search');
    await searchInput.clear();
    await pause(1000, 'Clear search');
  }

  // Category filter
  const nonVegButton = webPage.locator('button:has-text("NON-VEG STARTERS")').first();
  if (await nonVegButton.isVisible()) {
    await nonVegButton.click();
    await pause(1500, 'Filter by category');
    await screenshot(webContext, '09-web-menu-category-filter');
  }

  // Sort
  const sortSelect = webPage.locator('select');
  if (await sortSelect.isVisible()) {
    await sortSelect.selectOption('price-low');
    await pause(1500, 'Sort by price ascending');
    await screenshot(webContext, '10-web-menu-sorted');
  }

  // Add to cart
  const addButton = webPage.locator('button:has-text("+ Add")').first();
  if (await addButton.isVisible()) {
    await addButton.click();
    await pause(1000, 'Item added to cart');
    await screenshot(webContext, '11-web-menu-add-to-cart');
    
    // Add a few more items
    const addButtons = webPage.locator('button:has-text("+ Add")');
    const count = await addButtons.count();
    for (let i = 1; i < Math.min(3, count); i++) {
      await addButtons.nth(i).click();
      await pause(800, `Added item ${i + 1}`);
    }
    await screenshot(webContext, '12-web-menu-multiple-items');
  }

  // 3. Cart Page
  console.log('3️⃣  Cart Page');
  await webPage.goto(`${WEB_URL}/cart`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Cart with items');
  await screenshot(webContext, '13-web-cart-with-items');

  // 4. Auth Page
  console.log('4️⃣  Auth / Sign In Page');
  await webPage.goto(`${WEB_URL}/auth`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Login form with phone/email toggle');
  await screenshot(webContext, '14-web-auth-login');
  
  // Switch to email
  const emailToggle = webPage.locator('button:has-text("Email")');
  if (await emailToggle.isVisible()) {
    await emailToggle.click();
    await pause(1000, 'Switched to email login');
    await screenshot(webContext, '15-web-auth-email');
  }
  
  // Switch to signup
  const signUpLink = webPage.locator('button:has-text("Sign Up")');
  if (await signUpLink.isVisible()) {
    await signUpLink.click();
    await pause(1000, 'Sign up form');
    await screenshot(webContext, '16-web-auth-signup');
  }

  // 5. Orders Page (empty state)
  console.log('5️⃣  My Orders Page (empty/not signed in)');
  await webPage.goto(`${WEB_URL}/orders`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Orders page — sign in required');
  await screenshot(webContext, '17-web-orders-login-required');

  // 6. Track Page
  console.log('6️⃣  Order Tracking Page');
  await webPage.goto(`${WEB_URL}/track`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Track page — enter order ID');
  await screenshot(webContext, '18-web-track-empty');

  // 7. Checkout Page (empty state)
  console.log('7️⃣  Checkout Page');
  await webPage.goto(`${WEB_URL}/checkout`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Checkout multi-step form');
  await screenshot(webContext, '19-web-checkout');

  // Save web video
  const webVideo = webPage.video();
  if (webVideo) {
    await webPage.close();
    const videoPath = await webVideo.path();
    if (videoPath) {
      fs.copyFileSync(videoPath, path.join(OUTPUT_DIR, 'videos', 'web-app-demo.webm'));
      console.log('  🎥 Video saved: web-app-demo.webm');
    }
  }
  await webContext.close();

  // ========== PART 2: ADMIN DASHBOARD ==========
  console.log('\n🖥️  PART 2: Admin Dashboard (localhost:3002)\n');

  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.join(OUTPUT_DIR, 'videos'), size: { width: 1440, height: 900 } },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const adminPage = await adminContext.newPage();

  // Admin pages with error recovery
  const adminPages = [
    { name: 'Admin Login', url: `${ADMIN_URL}/login`, screenshots: ['20-admin-login'] },
    { name: 'Dashboard', url: `${ADMIN_URL}/`, screenshots: ['22-admin-dashboard', '23-admin-dashboard-full'], wait: 4000 },
    { name: 'KDS', url: `${ADMIN_URL}/kds`, screenshots: ['24-admin-kds'] },
    { name: 'Orders', url: `${ADMIN_URL}/orders`, screenshots: ['25-admin-orders'] },
    { name: 'Menu', url: `${ADMIN_URL}/menu`, screenshots: ['26-admin-menu'] },
    { name: 'Inventory', url: `${ADMIN_URL}/inventory`, screenshots: ['27-admin-inventory'] },
    { name: 'Analytics', url: `${ADMIN_URL}/analytics`, screenshots: ['28-admin-analytics'] },
    { name: 'AI Insights', url: `${ADMIN_URL}/ai-insights`, screenshots: ['29-admin-ai-sentiment'], action: 'forecast' },
    { name: 'Automation', url: `${ADMIN_URL}/automation`, screenshots: ['31-admin-automation'] },
    { name: 'Delivery', url: `${ADMIN_URL}/delivery`, screenshots: ['32-admin-delivery'] },
    { name: 'Customers', url: `${ADMIN_URL}/customers`, screenshots: ['33-admin-customers'] },
    { name: 'Riders', url: `${ADMIN_URL}/riders`, screenshots: ['34-admin-riders-map'] },
    { name: 'Settings', url: `${ADMIN_URL}/settings`, screenshots: ['35-admin-settings'] },
    { name: 'Webhooks', url: `${ADMIN_URL}/webhooks`, screenshots: ['36-admin-webhooks'] },
    { name: 'WH Analytics', url: `${ADMIN_URL}/webhooks/analytics`, screenshots: ['37-admin-webhooks-analytics'] },
    { name: 'WH Health', url: `${ADMIN_URL}/webhooks/health`, screenshots: ['38-admin-webhooks-health'] },
    { name: 'WH Alerts', url: `${ADMIN_URL}/webhooks/alerts`, screenshots: ['39-admin-webhooks-alerts'] },
    { name: 'WH Replay', url: `${ADMIN_URL}/webhooks/replay`, screenshots: ['40-admin-webhooks-replay'] },
    { name: 'Photos', url: `${ADMIN_URL}/photos`, screenshots: ['41-admin-photos'] },
    { name: 'Modifiers', url: `${ADMIN_URL}/menu-modifiers`, screenshots: ['42-admin-modifiers'] },
  ];

  // Login first
  try {
    console.log('8️⃣  Admin Login');
    await adminPage.goto(`${ADMIN_URL}/login`, { waitUntil: 'load', timeout: 60000 });
    await pause(2000, 'Admin login page');
    await screenshot(adminContext, '20-admin-login');
    await adminPage.fill('input[placeholder*="admin"]', ADMIN_EMAIL);
    await adminPage.fill('input[placeholder*="***"]', ADMIN_PASSWORD);
    await pause(1000, 'Credentials filled');
    await screenshot(adminContext, '21-admin-login-filled');
    await adminPage.click('button:has-text("Sign In")');
    await pause(4000, 'Login and dashboard loads');
    await screenshot(adminContext, '22-admin-dashboard');
  } catch (err) { console.log(`  ⚠️  Login failed: ${(err as Error).message?.slice(0, 80)}`); }

  // Navigate each admin page with error recovery
  for (const pg of adminPages.slice(1)) {
    try {
      console.log(`  ${pg.name}`);
      await adminPage.goto(pg.url, { waitUntil: 'load', timeout: 60000 });
      await pause(pg.wait || 3000, pg.name);
      if (pg.action === 'forecast') {
        const forecastBtn = adminPage.locator('button:has-text("Demand Forecast")');
        if (await forecastBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await forecastBtn.click();
          await pause(3000, 'AI demand forecast');
          await screenshot(adminContext, '30-admin-ai-forecast');
        }
      }
      for (const shot of pg.screenshots) {
        await screenshot(adminContext, shot);
      }
    } catch (err) { console.log(`  ⚠️  Skipped ${pg.name}: ${(err as Error).message?.slice(0, 80)}`); }
  }

  // Save admin video
  const adminVideo = adminPage.video();
  if (adminVideo) {
    await adminPage.close();
    const videoPath = await adminVideo.path();
    if (videoPath) {
      fs.copyFileSync(videoPath, path.join(OUTPUT_DIR, 'videos', 'admin-app-demo.webm'));
      console.log('  🎥 Video saved: admin-app-demo.webm');
    }
  }
  await adminContext.close();
  await browser.close();

  console.log('\n✅ ========================================');
  console.log('   Demo Walkthrough Complete!');
  console.log('   ========================================');
  console.log(`\n📁 Output: ${OUTPUT_DIR}`);
  console.log('   📹 videos/web-app-demo.webm');
  console.log('   📹 videos/admin-app-demo.webm');
  console.log('   📸 screenshots/ (42 screenshots)');
  console.log('\n   Use this script alongside the narration guide');
  console.log('   at docs/DEMO-NARRATION.md\n');
}

run().catch(err => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});
