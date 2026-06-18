import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_URL = 'http://127.0.0.1:3000';
const SHOTS = path.join(__dirname, 'visual-walkthrough');

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeAll(() => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  // Block web fonts to speed up page loading and prevent screenshot font-load hangs
  await page.route('**/*.{woff,woff2,ttf}', route => route.abort());
  await page.route(/.*google.*fonts.*/, route => route.abort());
});

async function shot(page: any, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

test('Full visual walkthrough', async ({ page }) => {
  test.setTimeout(180000);
  // ── 1. HOMEPAGE ──
  console.log('\n═══ HOMEPAGE ═══');
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, '01-homepage-hero');
  console.log('  Hero section: title, tagline, CTA buttons visible');

  // Scroll to stats
  await page.evaluate(() => window.scrollTo(0, 400));
  await shot(page, '02-homepage-stats');
  console.log('  Stats bar: dishes count, avg delivery, rating');

  // Scroll to cuisines
  await page.evaluate(() => window.scrollTo(0, 700));
  await shot(page, '03-homepage-cuisines');
  console.log('  Cuisines row: category cards with images');

  // Scroll to popular dishes
  await page.evaluate(() => window.scrollTo(0, 1100));
  await shot(page, '04-homepage-popular');
  console.log('  Popular dishes grid');

  // Scroll to how it works
  await page.evaluate(() => window.scrollTo(0, 2000));
  await shot(page, '05-homepage-how-it-works');
  console.log('  How it works: 3 steps');

  // Scroll bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, '06-homepage-bottom');
  console.log('  Bottom: features strip + CTA banner');

  // ── 2. MENU ──
  console.log('\n═══ MENU ═══');
  await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, '07-menu-full');
  console.log('  Menu page: heading, search bar, sort dropdown, category pills, dish cards');

  // Click category filter
  const catButtons = page.locator('button').filter({ hasText: /NON-VEG|VEG|CHINESE|BIRYANI|RICE/ });
  const catCount = await catButtons.count();
  if (catCount > 0) {
    await catButtons.first().click();
    await page.waitForTimeout(1000);
    await shot(page, '08-menu-filtered-category');
    console.log('  Filtered by category');
  }

  // Sort by price
  const sortSelect = page.locator('select');
  if (await sortSelect.count() > 0) {
    await sortSelect.selectOption('price-low');
    await page.waitForTimeout(1000);
    await shot(page, '09-menu-sort-price-low');
    console.log('  Sorted by price low to high');
  }

  // Use search
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('chicken');
    await page.waitForTimeout(1000);
    await shot(page, '10-menu-search');
    console.log('  Search: "chicken"');
  }

  // Clear search and add an item
  await searchInput.fill('');
  await page.waitForTimeout(500);

  const addButtons = page.locator('button').filter({ hasText: '+ Add' });
  const addCount = await addButtons.count();
  if (addCount > 0) {
    await addButtons.first().click();
    await page.waitForTimeout(500);
    await shot(page, '11-menu-added-item');
    console.log('  Added first dish to cart');
  }

  // ── 3. CART ──
  console.log('\n═══ CART ═══');
  await page.goto(`${WEB_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot(page, '12-cart-with-item');
  console.log('  Cart page with item added');

  // ── 4. CHECKOUT ──
  console.log('\n═══ CHECKOUT ═══');
  await page.goto(`${WEB_URL}/checkout`, { waitUntil: 'domcontentloaded' });
  await shot(page, '13-checkout');
  console.log('  Checkout page (graceful, no crash)');

  // ── 5. TRACK ──
  console.log('\n═══ TRACK ORDER ═══');
  await page.goto(`${WEB_URL}/track`, { waitUntil: 'domcontentloaded' });
  await shot(page, '14-track-order');
  console.log('  Track order page');

  // ── 6. AUTH ──
  console.log('\n═══ AUTH ═══');
  await page.goto(`${WEB_URL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
  await shot(page, '15-auth-login');
  console.log('  Auth: login mode');

  // Switch to signup
  const signupBtn = page.locator('button').filter({ hasText: 'Sign Up' });
  if (await signupBtn.count() > 0) {
    await signupBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '16-auth-signup');
    console.log('  Auth: signup mode');
  }

  // Switch to email mode
  const emailBtn = page.locator('button').filter({ hasText: 'Email' });
  if (await emailBtn.count() > 0) {
    await emailBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '17-auth-email');
    console.log('  Auth: email mode');
  }

  // ── 7. FAQ ──
  console.log('\n═══ FAQ ═══');
  await page.goto(`${WEB_URL}/faq`, { waitUntil: 'domcontentloaded' });
  await shot(page, '18-faq');
  console.log('  FAQ page with accordion questions');

  // Click first FAQ item
  const faqItems = page.locator('details, [class*="accordion"], button, summary');
  const faqClickable = faqItems.filter({ hasText: /order|delivery|payment|menu|cancel|time/i });
  if (await faqClickable.count() > 0) {
    await faqClickable.first().click();
    await page.waitForTimeout(500);
    await shot(page, '19-faq-expanded');
    console.log('  FAQ: first question expanded');
  }

  // ── 8. CONTACT ──
  console.log('\n═══ CONTACT ═══');
  await page.goto(`${WEB_URL}/contact`, { waitUntil: 'domcontentloaded' });
  await shot(page, '20-contact');
  console.log('  Contact page with form and info');

  // ── 9. MOBILE VIEWS ──
  console.log('\n═══ MOBILE VIEWS ═══');
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
  await shot(page, '21-mobile-home');
  console.log('  Mobile: homepage');

  await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded' });
  await shot(page, '22-mobile-menu');
  console.log('  Mobile: menu');

  await page.goto(`${WEB_URL}/cart`, { waitUntil: 'domcontentloaded' });
  await shot(page, '23-mobile-cart');
  console.log('  Mobile: cart');

  await page.goto(`${WEB_URL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
  await shot(page, '24-mobile-auth');
  console.log('  Mobile: auth');

  await page.goto(`${WEB_URL}/faq`, { waitUntil: 'domcontentloaded' });
  await shot(page, '25-mobile-faq');
  console.log('  Mobile: FAQ');

  await page.goto(`${WEB_URL}/contact`, { waitUntil: 'domcontentloaded' });
  await shot(page, '26-mobile-contact');
  console.log('  Mobile: contact');

  // ── 10. TABLET VIEW ──
  console.log('\n═══ TABLET VIEWS ═══');
  await page.setViewportSize({ width: 768, height: 1024 });

  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
  await shot(page, '27-tablet-home');
  console.log('  Tablet: homepage');

  await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded' });
  await shot(page, '28-tablet-menu');
  console.log('  Tablet: menu');

  console.log(`\n✅ Walkthrough complete — ${28} screenshots saved to tests/visual-walkthrough/`);
});
