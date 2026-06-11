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

  // 1. Homepage
  console.log('1️⃣  Homepage');
  await webPage.goto(WEB_URL, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Homepage hero section loads');
  await screenshot(webContext, '01-web-homepage-hero');
  
  // Scroll to show stats
  await webPage.evaluate(() => window.scrollBy(0, 400));
  await pause(2000, 'Stats bar scrolls into view');
  await screenshot(webContext, '02-web-homepage-stats');
  
  // Scroll to categories
  await webPage.evaluate(() => window.scrollBy(0, 400));
  await pause(2000, 'Category cards');
  await screenshot(webContext, '03-web-homepage-categories');
  
  // Scroll to popular dishes
  await webPage.evaluate(() => window.scrollBy(0, 500));
  await pause(2000, 'Popular dishes grid');
  await screenshot(webContext, '04-web-homepage-dishes');
  
  // Scroll to How it works
  await webPage.evaluate(() => window.scrollBy(0, 500));
  await pause(2000, 'How it works section');
  await screenshot(webContext, '05-web-homepage-how-it-works');
  
  // Scroll to features + CTA
  await webPage.evaluate(() => window.scrollBy(0, 500));
  await pause(2000, 'Features and CTA');
  await screenshot(webContext, '06-web-homepage-cta');

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

  // 8. Admin Login
  console.log('8️⃣  Admin Login');
  await adminPage.goto(`${ADMIN_URL}/login`, { waitUntil: 'load', timeout: 60000 });
  await pause(2000, 'Admin login page');
  await screenshot(adminContext, '20-admin-login');
  
  // Fill credentials
  await adminPage.fill('input[placeholder*="admin"]', ADMIN_EMAIL);
  await adminPage.fill('input[placeholder*="***"]', ADMIN_PASSWORD);
  await pause(1000, 'Credentials filled');
  await screenshot(adminContext, '21-admin-login-filled');
  
  // Submit
  await adminPage.click('button:has-text("Sign In")');
  await pause(4000, 'Login and dashboard loads');
  await screenshot(adminContext, '22-admin-dashboard');

  // 9. Dashboard
  console.log('9️⃣  Dashboard');
  await adminPage.waitForTimeout(4000);
  await screenshot(adminContext, '23-admin-dashboard-full');

  // 10. KDS (Kitchen Display System)
  console.log('🔟  Kitchen Display System');
  await adminPage.goto(`${ADMIN_URL}/kds`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'KDS Kanban board loads');
  await screenshot(adminContext, '24-admin-kds');

  // 11. Orders Management
  console.log('1️⃣1️⃣  Orders Management');
  await adminPage.goto(`${ADMIN_URL}/orders`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Orders table with status filters');
  await screenshot(adminContext, '25-admin-orders');

  // 12. Menu Management
  console.log('1️⃣2️⃣  Menu Management');
  await adminPage.goto(`${ADMIN_URL}/menu`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Menu categories and dishes');
  await screenshot(adminContext, '26-admin-menu');

  // 13. Inventory
  console.log('1️⃣3️⃣  Inventory');
  await adminPage.goto(`${ADMIN_URL}/inventory`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Inventory management');
  await screenshot(adminContext, '27-admin-inventory');

  // 14. Analytics
  console.log('1️⃣4️⃣  Analytics');
  await adminPage.goto(`${ADMIN_URL}/analytics`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Analytics dashboard');
  await screenshot(adminContext, '28-admin-analytics');

  // 15. AI Insights
  console.log('1️⃣5️⃣  AI Insights');
  await adminPage.goto(`${ADMIN_URL}/ai-insights`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'AI sentiment analysis');
  await screenshot(adminContext, '29-admin-ai-sentiment');
  
  // Switch to forecast tab
  const forecastBtn = adminPage.locator('button:has-text("Demand Forecast")');
  if (await forecastBtn.isVisible()) {
    await forecastBtn.click();
    await pause(3000, 'AI demand forecast');
    await screenshot(adminContext, '30-admin-ai-forecast');
  }

  // 16. Automation
  console.log('1️⃣6️⃣  Automation');
  await adminPage.goto(`${ADMIN_URL}/automation`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Automation rules and workflows');
  await screenshot(adminContext, '31-admin-automation');

  // 17. Delivery Zones
  console.log('1️⃣7️⃣  Delivery Zones');
  await adminPage.goto(`${ADMIN_URL}/delivery`, { waitUntil: 'load', timeout: 60000 });
  await pause(4000, 'Delivery zones map');
  await screenshot(adminContext, '32-admin-delivery');

  // 18. Customers
  console.log('1️⃣8️⃣  Customers');
  await adminPage.goto(`${ADMIN_URL}/customers`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Customer list');
  await screenshot(adminContext, '33-admin-customers');

  // 19. Riders Map
  console.log('1️⃣9️⃣  Live Rider Map');
  await adminPage.goto(`${ADMIN_URL}/riders`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Live rider tracking map');
  await screenshot(adminContext, '34-admin-riders-map');

  // 20. Settings
  console.log('2️⃣0️⃣  Settings');
  await adminPage.goto(`${ADMIN_URL}/settings`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Settings configuration');
  await screenshot(adminContext, '35-admin-settings');

  // 21. Webhooks Hub
  console.log('2️⃣1️⃣  Webhooks Hub');
  await adminPage.goto(`${ADMIN_URL}/webhooks`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Webhooks overview');
  await screenshot(adminContext, '36-admin-webhooks');

  // 22. Webhook Analytics
  console.log('2️⃣2️⃣  Webhook Analytics');
  await adminPage.goto(`${ADMIN_URL}/webhooks/analytics`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Webhook analytics');
  await screenshot(adminContext, '37-admin-webhooks-analytics');

  // 23. Webhook Health
  console.log('2️⃣3️⃣  Webhook Health');
  await adminPage.goto(`${ADMIN_URL}/webhooks/health`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Webhook health monitor');
  await screenshot(adminContext, '38-admin-webhooks-health');

  // 24. Webhook Alerts
  console.log('2️⃣4️⃣  Webhook Alerts');
  await adminPage.goto(`${ADMIN_URL}/webhooks/alerts`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Webhook alerts');
  await screenshot(adminContext, '39-admin-webhooks-alerts');

  // 25. Webhook Replay
  console.log('2️⃣5️⃣  Webhook Replay');
  await adminPage.goto(`${ADMIN_URL}/webhooks/replay`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Webhook replay tool');
  await screenshot(adminContext, '40-admin-webhooks-replay');

  // 26. Photos
  console.log('2️⃣6️⃣  Photos');
  await adminPage.goto(`${ADMIN_URL}/photos`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Photo management');
  await screenshot(adminContext, '41-admin-photos');

  // 27. Menu Modifiers
  console.log('2️⃣7️⃣  Menu Modifiers');
  await adminPage.goto(`${ADMIN_URL}/menu-modifiers`, { waitUntil: 'load', timeout: 60000 });
  await pause(3000, 'Menu modifiers');
  await screenshot(adminContext, '42-admin-modifiers');

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
