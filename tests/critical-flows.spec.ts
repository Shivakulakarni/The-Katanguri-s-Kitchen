import { test, expect } from '@playwright/test';

const WEB_URL = 'http://127.0.0.1:3000';
const ADMIN_URL = 'http://127.0.0.1:3002';

test('Order lifecycle flow: customer places order, admin updates status, customer tracks updates', async ({ browser }) => {
  // Step 1: Initialize pages
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  // Step 2: Login as customer using dev mode bypass
  console.log('Logging in as customer...');
  await customerPage.goto(`${WEB_URL}/auth`);
  
  // Enter phone number
  await customerPage.getByPlaceholder('98765 43210').fill('9876543001');
  await customerPage.getByRole('button', { name: 'Send OTP' }).click();

  // Handle dev mode OTP
  try {
    // Wait for redirect
    await customerPage.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 6000 });
  } catch {
    // Read OTP from screen
    const bodyText = await customerPage.textContent('body');
    const match = bodyText?.match(/Dev Mode: (\d{6})/);
    if (match && match[1]) {
      const otpVal = match[1];
      const otpInputs = customerPage.locator('input[maxlength="1"]');
      await otpInputs.first().focus();
      await customerPage.keyboard.type(otpVal, { delay: 100 });
      await customerPage.getByRole('button', { name: 'Verify & Sign In' }).click();
      await customerPage.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });
    } else {
      throw new Error('Dev bypass failed and no Dev Mode OTP found on screen.');
    }
  }

  // Confirm customer is logged in and on home page
  await expect(customerPage).toHaveURL(`${WEB_URL}/`);
  console.log('Customer logged in successfully!');

  // Step 3: Browse menu and add items to cart
  console.log('Browsing menu...');
  await customerPage.goto(`${WEB_URL}/menu`);
  
  // Wait for menu to load
  await customerPage.waitForSelector('button:has-text("+ Add")');
  
  // Add first dish
  await customerPage.locator('button:has-text("+ Add")').first().click();
  
  // Wait for cart badge or visual update
  await customerPage.waitForTimeout(1000);

  // Navigate to Cart
  console.log('Navigating to cart...');
  await customerPage.goto(`${WEB_URL}/cart`);
  await expect(customerPage.locator('h1:has-text("Your Cart")')).toBeVisible();

  // Check that item is in the cart
  await expect(customerPage.locator('a:has-text("Proceed to Checkout")')).toBeVisible();
  
  // Navigate to checkout
  console.log('Navigating to checkout...');
  await customerPage.locator('a:has-text("Proceed to Checkout")').click();
  await customerPage.waitForURL(`${WEB_URL}/checkout`);

  // Step 4: Fill Delivery Details (Checkout Step 1)
  console.log('Filling checkout details...');
  await customerPage.fill('input[placeholder="Address line"]', '123 Test Street, Jubilee Hills');
  await customerPage.fill('input[placeholder="City"]', 'Hyderabad');
  await customerPage.fill('input[placeholder="Pincode"]', '500033');
  
  await customerPage.locator('button:has-text("Continue")').click();
  await customerPage.waitForTimeout(1000);

  // Checkout Step 2: Select Cash on Delivery (already selected by default)
  await customerPage.locator('button:has-text("Review Order")').click();
  await customerPage.waitForTimeout(1000);

  // Checkout Step 3: Place Order
  console.log('Placing order...');
  await customerPage.locator('button:has-text("Place Order")').click();

  // Wait for redirect to track page
  await customerPage.waitForURL((url) => url.pathname.startsWith('/track'), { timeout: 15000 });
  const trackUrl = customerPage.url();
  console.log(`Order placed! Tracking URL: ${trackUrl}`);

  // Extract order ID from tracking page URL
  const orderIdMatch = trackUrl.match(/id=(\d+)/);
  if (!orderIdMatch) throw new Error('Could not parse order ID from URL');
  const orderId = orderIdMatch[1];
  console.log(`Parsed Order ID: ${orderId}`);

  // Assert initially PENDING on tracking page
  await expect(customerPage.getByText('Order Placed').first()).toBeVisible({ timeout: 10000 });
  
  // Step 5: Admin processes order in parallel
  console.log('Logging in as Admin...');
  await adminPage.goto(`${ADMIN_URL}/admin/login`);
  // Wait for login form to fully render (Next.js compiles route on first visit in dev mode)
  await adminPage.waitForSelector('input[type="email"]', { timeout: 30000 });
  await adminPage.locator('input[type="email"]').fill('admin@katanguri.com');
  await adminPage.locator('input[type="password"]').fill('admin123');
  await adminPage.locator('button:has-text("Sign In")').click();
  await adminPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  
  // Ensure we are on Dashboard or navigate to Orders
  console.log('Navigating to Admin Orders...');
  await adminPage.goto(`${ADMIN_URL}/admin/orders`);
  await expect(adminPage.locator('h1, h2').filter({ hasText: /orders/i }).first()).toBeVisible({ timeout: 15000 });

  // Find our placed order in the list
  const orderRow = adminPage.locator(`tr:has-text("#${orderId}")`);
  await expect(orderRow).toBeVisible({ timeout: 10000 });

  // Update status: PENDING -> CONFIRMED
  console.log('Admin: Confirming order...');
  const confirmBtn = orderRow.locator('button:has-text("CONFIRMED")');
  await confirmBtn.click();
  
  // Assert customer tracking page updates to Confirmed
  console.log('Customer Tracking: Verifying status CONFIRMED...');
  await expect(customerPage.getByText('Confirmed').first()).toBeVisible({ timeout: 15000 });

  // Update status: CONFIRMED -> PREPARING
  console.log('Admin: Preparing order...');
  const prepareBtn = orderRow.locator('button:has-text("PREPARING")');
  await prepareBtn.click();

  // Assert customer tracking page updates to Preparing
  console.log('Customer Tracking: Verifying status PREPARING...');
  await expect(customerPage.getByText('Preparing').first()).toBeVisible({ timeout: 15000 });

  // Update status: PREPARING -> READY
  console.log('Admin: Mark order as READY...');
  const readyBtn = orderRow.locator('button:has-text("READY")');
  await readyBtn.click();

  // Assert customer tracking page updates to Quality Check (which corresponds to READY in track ui)
  console.log('Customer Tracking: Verifying status QUALITY_CHECK (Quality Check)...');
  await expect(customerPage.getByText('Quality Check').first()).toBeVisible({ timeout: 15000 });

  // Update status: READY -> OUT_FOR_DELIVERY
  console.log('Admin: Mark order OUT FOR DELIVERY...');
  const outBtn = orderRow.locator('button:has-text("OUT FOR DELIVERY")');
  await outBtn.click();

  // Assert customer tracking page updates to Out for Delivery
  console.log('Customer Tracking: Verifying status OUT_FOR_DELIVERY (Out for Delivery)...');
  await expect(customerPage.getByText('Out for Delivery').first()).toBeVisible({ timeout: 15000 });

  // Update status: OUT_FOR_DELIVERY -> DELIVERED
  console.log('Admin: Mark order DELIVERED...');
  const deliveredBtn = orderRow.locator('button:has-text("DELIVERED")');
  await deliveredBtn.click();

  // Assert customer tracking page updates to Delivered
  console.log('Customer Tracking: Verifying status DELIVERED...');
  await expect(customerPage.getByText('Delivered').first()).toBeVisible({ timeout: 15000 });

  console.log('E2E Order Lifecycle Flow completed successfully!');

  // Cleanup
  await customerContext.close();
  await adminContext.close();
});
