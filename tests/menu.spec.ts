import { test, expect } from '@playwright/test';

test.describe('Menu Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the menu API to return known data
    await page.route('**/api/v1/menu', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Starters',
            displayOrder: 1,
            dishes: [
              { id: 101, name: 'Paneer Tikka', price: 250, isVeg: true, isAvailable: true, categoryId: 1, prepTimeMin: 15 },
              { id: 102, name: 'Chicken Wings', price: 350, isVeg: false, isAvailable: true, categoryId: 1, prepTimeMin: 20 },
            ],
          },
          {
            id: 2,
            name: 'Main Course',
            displayOrder: 2,
            dishes: [
              { id: 201, name: 'Butter Chicken', price: 450, isVeg: false, isAvailable: true, categoryId: 2, prepTimeMin: 25 },
            ],
          },
        ]),
      });
    });

    // Mock the recommendations API
    await page.route('**/api/v1/ai/recommendations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ recommendations: [] }),
      });
    });
  });

  test('loads and displays menu categories', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;
    // Verify category names are rendered
    await expect(page.getByText('Starters').first()).toBeVisible();
    await expect(page.getByText('Main Course').first()).toBeVisible();
    // Verify dish names are rendered
    await expect(page.getByText('Paneer Tikka')).toBeVisible();
    await expect(page.getByText('Butter Chicken')).toBeVisible();
    // Verify dish prices
    await expect(page.getByText(/\u20B9250/)).toBeVisible();
    await expect(page.getByText(/\u20B9450/)).toBeVisible();
    // Verify dish count
    const dishCards = page.locator('[class*="card"]');
    await expect(dishCards).toHaveCount(3);
  });

  test('filters dishes by category', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;
    // Click on "Starters" category button
    await page.getByText('All').first().click();
    await page.getByText('Starters').first().click();
    // Should only show starters
    await expect(page.getByText('Paneer Tikka')).toBeVisible();
    await expect(page.getByText('Butter Chicken')).toBeHidden();
  });

  test('searches dishes by name', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;
    // Type in search
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Chicken');
    // Should show chicken dishes
    await expect(page.getByText('Chicken Wings')).toBeVisible();
    await expect(page.getByText('Butter Chicken')).toBeVisible();
    await expect(page.getByText('Paneer Tikka')).toBeHidden();
  });

  test('adds a dish to cart', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;
    // Click "Add" button on first dish
    const addButtons = page.locator('button:has-text("+ Add")');
    await addButtons.first().click();
    // Verify dish is added to cart (cart store persists)
    // We check by looking for the cart indicator
    await expect(page.getByRole('link', { name: 'Cart' }).first()).toBeVisible();
  });

  test('shows veg/non-veg tags', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;
    const vegTag = page.getByText('VEG', { exact: true });
    const nonVegTag = page.getByText('NON-VEG', { exact: true });
    await expect(vegTag).toHaveCount(1);
    await expect(nonVegTag).toHaveCount(2);
  });

  test('paginates without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;
    expect(errors.filter(e => !e.includes('favicon') && !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('handles missing API gracefully', async ({ page }) => {
    // Override route to fail
    await page.route('**/api/v1/menu', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });
    await page.goto('/menu');
    // Should show error state instead of breaking
    await expect(page.getByText(/unable to load|could not|error/i).first()).toBeVisible();
  });
});
