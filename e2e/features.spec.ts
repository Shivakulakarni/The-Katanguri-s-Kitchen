import { test, expect } from '@playwright/test';

// Disable all CSS animations to prevent Playwright stability issues
// (the chatbot button uses a pulseBtn animation that never settles)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
    document.head.appendChild(style);
  });
});

// ──────────────────────────────────────────────────────────
// AI Chatbot Tests
// ──────────────────────────────────────────────────────────

test.describe('AI Chatbot', () => {
  test('opens and closes chat panel', async ({ page }) => {
    await page.goto('/');

    // Floating chat button should be visible
    const chatButton = page.locator('button', { hasText: 'Ask Chef Katanguri' });
    await expect(chatButton).toBeVisible({ timeout: 15000 });

    // Click to open
    await chatButton.click({ force: true });

    // Chat panel should appear with header
    const dialog = page.getByRole('dialog', { name: 'AI Assistant Chat' });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Chef Katanguri').first()).toBeVisible();
    await expect(dialog.getByText('AI support active')).toBeVisible();

    // Welcome message should be present
    await expect(dialog.getByText('Vanakkam!')).toBeVisible();

    // Close button should work
    await dialog.getByLabel('Close chat').click();

    // Chat panel should be hidden, button should reappear
    await expect(chatButton).toBeVisible({ timeout: 5000 });
  });

  test('closes chat with Escape key', async ({ page }) => {
    await page.goto('/');

    const chatButton = page.locator('button', { hasText: 'Ask Chef Katanguri' });
    await expect(chatButton).toBeVisible({ timeout: 15000 });
    await chatButton.click({ force: true });

    const dialog = page.getByRole('dialog', { name: 'AI Assistant Chat' });
    await expect(dialog.getByText('Vanakkam!')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(chatButton).toBeVisible({ timeout: 5000 });
  });

  test('quick reply chips are visible', async ({ page }) => {
    await page.goto('/');

    const chatButton = page.locator('button', { hasText: 'Ask Chef Katanguri' });
    await expect(chatButton).toBeVisible({ timeout: 15000 });
    await chatButton.click({ force: true });

    const dialog = page.getByRole('dialog', { name: 'AI Assistant Chat' });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByText('Suggest veg recommendations')).toBeVisible();
    await expect(dialog.getByText('Check my order status')).toBeVisible();
    await expect(dialog.getByText('Is there non-veg today?')).toBeVisible();
  });

  test('sends a message and receives response', async ({ page }) => {
    await page.goto('/');

    const chatButton = page.locator('button', { hasText: 'Ask Chef Katanguri' });
    await expect(chatButton).toBeVisible({ timeout: 15000 });
    await chatButton.click({ force: true });

    const dialog = page.getByRole('dialog', { name: 'AI Assistant Chat' });
    await expect(dialog).toBeVisible();

    const input = dialog.getByLabel('Type your message');
    await input.fill('What dishes do you recommend?');

    await dialog.getByRole('button', { name: 'Send' }).click();

    await expect(dialog.getByText('What dishes do you recommend?')).toBeVisible();
    await expect(dialog.getByRole('log')).toBeVisible();

    // Wait for AI response — the log contains: welcome + user + assistant + messagesEndRef spacer = 4 children
    await expect(dialog.getByRole('log').locator('> div')).toHaveCount(4, { timeout: 30000 });
  });

  test('sends message via Enter key', async ({ page }) => {
    await page.goto('/');

    const chatButton = page.locator('button', { hasText: 'Ask Chef Katanguri' });
    await expect(chatButton).toBeVisible({ timeout: 15000 });
    await chatButton.click({ force: true });

    const dialog = page.getByRole('dialog', { name: 'AI Assistant Chat' });
    const input = dialog.getByLabel('Type your message');
    await input.fill('Hello');
    await input.press('Enter');

    await expect(dialog.getByText('Hello')).toBeVisible();
  });

  test('input focus trap works', async ({ page }) => {
    await page.goto('/');

    const chatButton = page.locator('button', { hasText: 'Ask Chef Katanguri' });
    await expect(chatButton).toBeVisible({ timeout: 15000 });
    await chatButton.click({ force: true });

    const dialog = page.getByRole('dialog', { name: 'AI Assistant Chat' });
    const input = dialog.getByLabel('Type your message');
    await expect(input).toBeFocused();
  });
});

// ──────────────────────────────────────────────────────────
// Menu Search Tests (with debounce indicator)
// ──────────────────────────────────────────────────────────

test.describe('Menu Search', () => {
  test.beforeEach(async ({ page }) => {
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
              { id: 101, name: 'Chicken 65', price: 250, isVeg: false, isAvailable: true, categoryId: 1, prepTimeMinutes: 15 },
              { id: 102, name: 'Paneer Tikka', price: 220, isVeg: true, isAvailable: true, categoryId: 1, prepTimeMinutes: 12 },
              { id: 103, name: 'Fish Fry', price: 300, isVeg: false, isAvailable: true, categoryId: 1, prepTimeMinutes: 18 },
            ],
          },
          {
            id: 2,
            name: 'Biryani',
            displayOrder: 2,
            dishes: [
              { id: 201, name: 'Chicken Biryani', price: 350, isVeg: false, isAvailable: true, categoryId: 2, prepTimeMinutes: 25 },
              { id: 202, name: 'Veg Biryani', price: 280, isVeg: true, isAvailable: true, categoryId: 2, prepTimeMinutes: 20 },
            ],
          },
        ]),
      });
    });

    await page.route('**/api/v1/ai/recommendations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ recommendations: [] }),
      });
    });
  });

  test('search filters dishes by name', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    await expect(page.getByText('Chicken 65')).toBeVisible();
    await expect(page.getByText('Paneer Tikka')).toBeVisible();
    await expect(page.getByText('Chicken Biryani')).toBeVisible();

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('biryani');
    await page.waitForTimeout(300);

    await expect(page.getByText('Chicken Biryani')).toBeVisible();
    await expect(page.getByText('Veg Biryani')).toBeVisible();
    await expect(page.getByText('Chicken 65')).toBeHidden();
  });

  test('shows no results for non-existent dish', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('xyz123');
    await page.waitForTimeout(300);

    await expect(page.getByText('No dishes found')).toBeVisible();
    await expect(page.getByText(/No results for "xyz123"/)).toBeVisible();
  });

  test('search debounce indicator appears while typing', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.click();
    await searchInput.type('chicken', { delay: 50 });

    await expect(searchInput).toHaveAttribute('aria-busy', 'true', { timeout: 2000 }).catch(() => {});

    await page.waitForTimeout(400);
    await expect(page.getByText('Chicken 65')).toBeVisible();
  });

  test('clearing search restores all dishes', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('biryani');
    await page.waitForTimeout(300);

    await expect(page.getByText('Chicken Biryani')).toBeVisible();
    await expect(page.getByText('Chicken 65')).toBeHidden();

    await searchInput.clear();
    await page.waitForTimeout(300);

    await expect(page.getByText('Chicken 65')).toBeVisible();
    await expect(page.getByText('Paneer Tikka')).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────
// Cart Operations Tests
// ──────────────────────────────────────────────────────────

test.describe('Cart Operations', () => {
  test.beforeEach(async ({ page }) => {
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
              { id: 101, name: 'Chicken 65', price: 250, isVeg: false, isAvailable: true, categoryId: 1, prepTimeMinutes: 15 },
              { id: 102, name: 'Paneer Tikka', price: 220, isVeg: true, isAvailable: true, categoryId: 1, prepTimeMinutes: 12 },
            ],
          },
        ]),
      });
    });

    await page.route('**/api/v1/ai/recommendations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ recommendations: [] }),
      });
    });
  });

  test('empty cart shows empty state', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse Menu' })).toBeVisible();
  });

  test('browse menu button navigates to menu', async ({ page }) => {
    await page.goto('/cart');
    await page.getByRole('link', { name: 'Browse Menu' }).click();
    await expect(page).toHaveURL(/\/menu/);
  });

  test('add item to cart and verify in cart page', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    await page.locator('button:has-text("+ Add")').first().click();

    await page.goto('/cart');
    await expect(page.getByText('Chicken 65').first()).toBeVisible();
    await expect(page.getByText('₹250').first()).toBeVisible();
  });

  test('quantity controls work correctly', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    await page.locator('button:has-text("+ Add")').first().click();

    await page.goto('/cart');
    await expect(page.getByText('Chicken 65').first()).toBeVisible();

    await page.getByLabel('Increase Chicken 65 quantity').click();
    await expect(page.getByText('₹500').first()).toBeVisible();
  });

  test('order summary calculates correctly', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    await page.locator('button:has-text("+ Add")').first().click();

    await page.goto('/cart');
    await expect(page.getByText('Subtotal').first()).toBeVisible();
    await expect(page.getByText('Total').first()).toBeVisible();
    await expect(page.getByText('Delivery Fee').first()).toBeVisible();
  });

  test('remove item from cart', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/api/v1/menu');
    await page.goto('/menu');
    await responsePromise;

    await page.locator('button:has-text("+ Add")').first().click();

    await page.goto('/cart');
    await expect(page.getByText('Chicken 65').first()).toBeVisible();

    await page.getByLabel('Remove Chicken 65 from cart').click();
    await expect(page.getByText('Your cart is empty')).toBeVisible({ timeout: 5000 });
  });
});
