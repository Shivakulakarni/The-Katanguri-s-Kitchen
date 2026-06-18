import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the menu API for featured items
    await page.route('**/api/v1/menu', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1, name: 'Popular', displayOrder: 1,
            dishes: [
              { id: 1, name: 'Dish 1', price: 200, isVeg: true, isAvailable: true, categoryId: 1 },
              { id: 2, name: 'Dish 2', price: 300, isVeg: false, isAvailable: true, categoryId: 1 },
            ],
          },
        ]),
      });
    });
  });

  test('loads homepage with branding', async ({ page }) => {
    await page.goto('/');
    // Check page title / branding
    await expect(page.getByText(/Katanguri/i).first()).toBeVisible();
    // Check navigation is present
    await expect(page.getByRole('link', { name: 'Menu' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart' }).first()).toBeVisible();
  });

  test('navigation links work correctly', async ({ page }) => {
    await page.goto('/');
    // Navigate to menu
    await page.getByRole('link', { name: 'Menu' }).first().click();
    await page.waitForURL('**/menu');
    // Navigate back to home
    await page.getByText(/Katanguri/i).first().click();
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '');
  });
});
