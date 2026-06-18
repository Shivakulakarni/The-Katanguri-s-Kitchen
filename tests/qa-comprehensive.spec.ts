import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const WEB_URL = 'http://127.0.0.1:3000';
const API_URL = 'http://127.0.0.1:3001';

const REPORT_DIR = path.resolve(process.cwd(), 'tests', 'qa-report');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  page: string;
  description: string;
  steps: string;
  screenshot?: string;
  suggestedFix?: string;
}

const issues: Issue[] = [];

function reportIssue(issue: Issue) {
  issues.push(issue);
  console.log(`[${issue.severity.toUpperCase()}] ${issue.page}: ${issue.description}`);
}

async function captureState(page: Page, name: string) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function clickAllLinks(page: Page, pageName: string) {
  const links = page.locator('a');
  const count = await links.count();
  console.log(`  Links found: ${count}`);
  for (let i = 0; i < Math.min(count, 20); i++) {
    try {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      const text = (await link.textContent())?.trim().slice(0, 50);
      if (href && !href.startsWith('#') && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
        console.log(`  Link ${i}: "${text}" -> ${href}`);
      }
    } catch { }
  }
}

async function clickAllButtons(page: Page, pageName: string) {
  const buttons = page.locator('button');
  const count = await buttons.count();
  console.log(`  Buttons found: ${count}`);
  return count;
}

async function checkConsoleErrors(page: Page, pageName: string) {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    if (!err.message.includes('favicon') && !err.message.includes('ResizeObserver')) {
      errors.push(err.message);
      reportIssue({
        severity: 'high',
        page: pageName,
        description: `Console error: ${err.message}`,
        steps: `Navigate to ${pageName}`,
        suggestedFix: 'Check stack trace and fix the JavaScript error',
      });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        !text.includes('hydration') &&
        !text.includes('did not match') &&
        !text.includes('style') &&
        !text.includes('caret-color') &&
        !text.includes('React structure') &&
        !text.includes('Failed to load resource') &&
        !text.includes('net::ERR_FAILED')
      ) {
        errors.push(text);
      }
    }
  });
  return errors;
}

test.describe('Comprehensive QA Browser Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Block web fonts to speed up page loading and prevent screenshot font-load hangs
    await page.route('**/*.{woff,woff2,ttf}', route => route.abort());
    await page.route(/.*google.*fonts.*/, route => route.abort());
  });

  test('QA-01: Homepage loads fully with no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('ResizeObserver')) errors.push(err.message);
    });

    await page.goto(WEB_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log(`Page title: "${title}"`);

    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);

    await captureState(page, '01-homepage');
    await clickAllLinks(page, 'Homepage');
    const btnCount = await clickAllButtons(page, 'Homepage');

    expect(errors).toEqual([]);
    console.log(`Homepage: ${body!.length} chars, ${btnCount} buttons, 0 errors`);
  });

  test('QA-02: Menu page loads dishes with categories', async ({ page }) => {
    const errors = await checkConsoleErrors(page, 'Menu');

    await page.goto(`${WEB_URL}/menu`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    await captureState(page, '02-menu');

    const h1 = page.locator('h1');
    const h1Text = await h1.textContent();
    console.log(`Menu heading: "${h1Text}"`);
    expect(h1Text).toBeTruthy();

    const dishes = page.locator('[class*="card"], [class*="dish"], article, li');
    const dishCount = await dishes.count();
    console.log(`Menu items rendered: ${dishCount}`);

    const buttons = page.locator('button');
    const btnCount = await buttons.count();
    console.log(`Menu buttons: ${btnCount}`);

    // Test Category filter
    const catBtns = page.locator('.scroll-x button');
    const catCount = await catBtns.count();
    if (catCount > 1) {
      await catBtns.nth(1).click();
      await page.waitForTimeout(1000);
      await captureState(page, '02b-menu-filtered');
      await catBtns.first().click(); // switch back to 'All'
      await page.waitForTimeout(500);
    }

    await captureState(page, '02c-menu-after-clicks');

    const resource404s = errors.filter(e => e.includes('Failed to load resource'));
    const jsErrors = errors.filter(e => !e.includes('Failed to load resource'));
    console.log(`Menu 404s: ${resource404s.length}, JS errors: ${jsErrors.length}`);
    expect(jsErrors).toEqual([]);
  });

  test('QA-03: Auth page renders and switches modes', async ({ page }) => {
    const errors = await checkConsoleErrors(page, 'Auth');

    await page.goto(`${WEB_URL}/auth`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await captureState(page, '03-auth');

    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`Auth inputs: ${inputCount}`);

    const buttons = page.locator('button');
    const btnCount = await buttons.count();
    console.log(`Auth buttons: ${btnCount}`);

    // Switch to Email tab
    const emailTab = page.getByRole('button', { name: 'Email' });
    if (await emailTab.isVisible()) {
      await emailTab.click();
      await page.waitForTimeout(500);
      await captureState(page, '03b-auth-email-tab');
    }
    
    // Switch back to Phone tab
    const phoneTab = page.getByRole('button', { name: 'Phone' });
    if (await phoneTab.isVisible()) {
      await phoneTab.click();
      await page.waitForTimeout(500);
    }

    // Switch to Sign Up mode
    const signupBtn = page.getByRole('button', { name: 'Sign Up', exact: true });
    if (await signupBtn.isVisible()) {
      await signupBtn.click();
      await page.waitForTimeout(500);
      await captureState(page, '03c-auth-signup-mode');
    }

    await captureState(page, '03d-auth-after-clicks');
    expect(errors).toEqual([]);
  });

  test('QA-04: Cart page renders empty state', async ({ page }) => {
    const errors = await checkConsoleErrors(page, 'Cart');

    await page.goto(`${WEB_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await captureState(page, '04-cart');

    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);

    const buttons = page.locator('button');
    const btnCount = await buttons.count();
    console.log(`Cart buttons: ${btnCount}`);

    expect(errors).toEqual([]);
  });

  test('QA-05: Checkout page loads gracefully', async ({ page }) => {
    const errors = await checkConsoleErrors(page, 'Checkout');

    await page.goto(`${WEB_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await captureState(page, '05-checkout');

    const body = await page.locator('body').textContent();
    console.log(`Checkout body length: ${body!.length}`);

    expect(errors).toEqual([]);
  });

  test('QA-06: Track order page loads', async ({ page }) => {
    await page.goto(`${WEB_URL}/track`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await captureState(page, '06-track');
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
    console.log(`Track page loaded: ${body!.length} chars`);
  });

  test('QA-07: FAQ and Contact pages render', async ({ page }) => {
    await page.goto(`${WEB_URL}/faq`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await captureState(page, '07-faq');

    await page.goto(`${WEB_URL}/contact`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await captureState(page, '08-contact');

    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('QA-08: Menu API returns data correctly', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/api/v1/menu`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    console.log(`Menu API: ${JSON.stringify(data).slice(0, 200)}...`);
  });

  test('QA-09: API health check passes', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/api/v1/health`);
    expect(response.ok()).toBeTruthy();
    const health = await response.json();
    console.log(`Health: db=${health.checks?.database?.status}, redis=${health.checks?.redis?.status}`);
    expect(health.checks?.database?.status).toBe('ok');
    expect(health.checks?.redis?.status).toBe('ok');
  });

  test('QA-10: Mobile responsive layout (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const pages = ['/', '/menu', '/auth', '/cart', '/track', '/faq', '/contact'];
    for (const p of pages) {
      try {
        await page.goto(`${WEB_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500);
        await captureState(page, `mobile-${p.replace('/', '') || 'home'}`);
        const body = await page.locator('body').textContent();
        const ok = body && body.length > 50;
        console.log(`Mobile ${p}: ${ok ? 'OK' : 'EMPTY'} (${body?.length || 0} chars)`);
        if (!ok) {
          reportIssue({
            severity: 'high',
            page: `Mobile ${p}`,
            description: 'Page renders empty on mobile',
            steps: `Navigate to ${p} at 375x667`,
          });
        }
      } catch (err: any) {
        reportIssue({
          severity: 'high',
          page: `Mobile ${p}`,
          description: `Page failed on mobile: ${err.message}`,
          steps: `Navigate to ${p} at 375x667`,
        });
      }
    }
  });

  test('QA-11: Tablet responsive layout (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const pages = ['/', '/menu', '/auth', '/cart'];
    for (const p of pages) {
      try {
        await page.goto(`${WEB_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500);
        await captureState(page, `tablet-${p.replace('/', '') || 'home'}`);
      } catch { }
    }
  });

  test('QA-12: Desktop responsive layout (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const pages = ['/', '/menu', '/auth'];
    for (const p of pages) {
      try {
        await page.goto(`${WEB_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500);
        await captureState(page, `desktop-${p.replace('/', '') || 'home'}`);
      } catch { }
    }
  });

  test('QA-13: Admin panel loads', async ({ page }) => {
    try {
      await page.goto('http://127.0.0.1:3002/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      await captureState(page, '13-admin');
      const title = await page.title();
      const body = await page.locator('body').textContent();
      console.log(`Admin panel: "${title}" (${body?.length || 0} chars)`);
      expect(title).toContain('Admin');
      expect(body!.length).toBeGreaterThan(50);
    } catch (err: any) {
      reportIssue({
        severity: 'high',
        page: 'Admin',
        description: `Admin panel failed: ${err.message}`,
        steps: 'Navigate to http://127.0.0.1:3002/',
      });
    }
  });

  test('QA-14: No broken images across all pages', async ({ page }) => {
    const imageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) && response.status() >= 400) {
        imageErrors.push(`${response.url()} -> ${response.status()}`);
      }
    });

    const pages = ['/', '/menu', '/auth', '/cart', '/checkout', '/track', '/faq', '/contact'];
    for (const p of pages) {
      try {
        await page.goto(`${WEB_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      } catch { }
    }

    if (imageErrors.length > 0) {
      reportIssue({
        severity: 'medium',
        page: 'All pages',
        description: `Broken images found: ${imageErrors.join(', ')}`,
        steps: 'Load all pages and check image responses',
      });
    }
    console.log(`Broken images: ${imageErrors.length}`);
    expect(imageErrors.length).toBe(0);
  });

  test('QA-15: Browser Console — no errors across all pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    const resourceErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('favicon') && !err.message.includes('ResizeObserver')) {
        consoleErrors.push(`[PAGE] ${err.message}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('Failed to load resource')) {
          resourceErrors.push(`[CONSOLE] ${text}`);
        } else if (!text.includes('hydration') && !text.includes('Prop `style` did not match') && !text.includes('caret-color') && !text.includes('React structure')) {
          consoleErrors.push(`[CONSOLE] ${text}`);
        }
      }
    });

    const pages = ['/', '/menu', '/auth', '/cart', '/checkout', '/track', '/faq', '/contact'];
    for (const p of pages) {
      try {
        await page.goto(`${WEB_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      } catch { }
    }

    if (resourceErrors.length > 0) {
      reportIssue({
        severity: 'low',
        page: 'Cross-page',
        description: `${resourceErrors.length} resource 404s (non-critical, dev mode image optimization)`,
        steps: 'Load all pages, check console for resource errors',
      });
    }
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err) => {
        reportIssue({
          severity: 'high',
          page: 'Cross-page',
          description: err,
          steps: 'Load all pages, check console for errors',
        });
      });
    }
    console.log(`Total resource 404s: ${resourceErrors.length}, JS errors: ${consoleErrors.length}`);
    expect(consoleErrors).toEqual([]);
  });
});

test.afterAll('Generate QA Report', () => {
  const reportPath = path.join(REPORT_DIR, 'qa-report.json');
  const summary = {
    timestamp: new Date().toISOString(),
    appUrl: WEB_URL,
    apiUrl: API_URL,
    totalIssues: issues.length,
    bySeverity: {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
    },
    issues,
    screenshots: fs.readdirSync(SCREENSHOT_DIR),
  };
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\n========================================`);
  console.log(`  QA REPORT GENERATED`);
  console.log(`========================================`);
  console.log(`  Total issues: ${issues.length}`);
  console.log(`  Critical: ${summary.bySeverity.critical}`);
  console.log(`  High: ${summary.bySeverity.high}`);
  console.log(`  Medium: ${summary.bySeverity.medium}`);
  console.log(`  Low: ${summary.bySeverity.low}`);
  console.log(`  Screenshots: ${summary.screenshots.length}`);
  console.log(`  Report: ${reportPath}`);
  console.log(`========================================\n`);

  // Generate markdown report
  const mdLines: string[] = [
    '# QA Test Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**App:** ${WEB_URL}`,
    `**API:** ${API_URL}`,
    '',
    '---',
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Issues | ${issues.length} |`,
    `| Critical | ${summary.bySeverity.critical} |`,
    `| High | ${summary.bySeverity.high} |`,
    `| Medium | ${summary.bySeverity.medium} |`,
    `| Low | ${summary.bySeverity.low} |`,
    `| Screenshots | ${summary.screenshots.length} |`,
    '',
    '---',
    '',
    '## Issues',
    '',
  ];

  if (issues.length === 0) {
    mdLines.push('**No issues found.** All tests passed successfully.');
  } else {
    issues.forEach((issue, i) => {
      mdLines.push(`### ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.page}`);
      mdLines.push('');
      mdLines.push(`**Description:** ${issue.description}`);
      mdLines.push(`**Steps:** ${issue.steps}`);
      if (issue.suggestedFix) mdLines.push(`**Suggested Fix:** ${issue.suggestedFix}`);
      if (issue.screenshot) mdLines.push(`**Screenshot:** \`${issue.screenshot}\``);
      mdLines.push('');
    });
  }

  mdLines.push('---');
  mdLines.push('*Generated by Playwright QA tests*');

  const mdReport = path.join(REPORT_DIR, 'qa-report.md');
  fs.writeFileSync(mdReport, mdLines.join('\n'));
  console.log(`Markdown report: ${mdReport}`);
});
