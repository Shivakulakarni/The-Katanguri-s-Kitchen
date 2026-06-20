import { test, expect } from '@playwright/test';

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Set auth cookie and mock profile endpoint for admin pages
    await page.context().addCookies([
      { name: 'access_token', value: 'mock-admin-token', domain: '127.0.0.1', path: '/admin' },
    ]);
    await page.route('**/api/v1/customer/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Admin', email: 'admin@kitchen.app', role: 'admin' }),
      });
    });
  });

  test('admin dashboard shows stats', async ({ page }) => {
    // Mock orders stats
    await page.route('**/api/v1/admin/orders/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          revenueToday: 12500,
          totalToday: 15,
          delivered: 10,
          pending: 3,
          confirmed: 1,
          preparing: 1,
          outForDelivery: 0,
          cancelled: 0,
        }),
      });
    });
    await page.route('**/api/v1/admin/orders?limit=10', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            { id: 1, status: 'DELIVERED', totalAmount: '450', createdAt: new Date().toISOString(), customerId: 1, notes: 'Test order 1' },
            { id: 2, status: 'PENDING', totalAmount: '350', createdAt: new Date().toISOString(), customerId: 2, notes: 'Test order 2' },
          ],
        }),
      });
    });

    await page.goto('http://127.0.0.1:3002/admin/');
    await page.waitForResponse('**/api/v1/admin/orders/stats');
    // Check KPI values are displayed
    await expect(page.getByText(/Revenue Today/)).toBeVisible();
    await expect(page.getByText(/12,500/)).toBeVisible();
    await expect(page.getByText(/Orders Today/)).toBeVisible();
    await expect(page.getByText('15', { exact: true }).first()).toBeVisible();
  });

  test('admin sidebar navigation works', async ({ page }) => {
    await page.goto('http://127.0.0.1:3002/admin/');
    // Navigate to orders
    await page.getByRole('link', { name: 'Orders' }).first().click();
    await page.waitForURL('**/admin/orders');
    // Navigate to inventory
    await page.getByRole('link', { name: 'Inventory' }).first().click();
    await page.waitForURL('**/admin/inventory');
    // Navigate to menu
    await page.getByRole('link', { name: 'Menu' }).first().click();
    await page.waitForURL('**/admin/menu');
  });

  test('admin login page renders', async ({ page }) => {
    await page.goto('http://127.0.0.1:3002/admin/login');
    await expect(page.getByText('Sign in to access the admin dashboard')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Email OTP' })).toBeVisible();
  });
});
