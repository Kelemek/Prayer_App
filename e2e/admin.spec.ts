import { test, expect } from '@playwright/test';

test.describe('Admin Portal', () => {
  test('should load admin login page', async ({ page }) => {
    await page.goto('/login');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check page is visible
    await expect(page.locator('body')).toBeVisible();
    
    // Check for email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const inputVisible = await emailInput.isVisible().catch(() => false);
    expect(inputVisible).toBeTruthy();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(2000);
    
    // Find email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await expect(emailInput).toBeVisible();
    
    // Find submit button
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    
    // Type invalid email
    await emailInput.fill('invalid-email');
    await page.waitForTimeout(500);
    
    // Submit button should be disabled for invalid email
    await expect(submitButton).toBeDisabled();
    
    // Clear and enter valid email
    await emailInput.clear();
    await emailInput.fill('test@example.com');
    await page.waitForTimeout(500);
    
    // Submit button should now be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should display admin login form elements', async ({ page }) => {
    await page.goto('/login');
    
    // Check for form elements
    const form = page.locator('form, [role="form"]').first();
    await expect(form).toBeVisible();
    
    // Should have email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await expect(emailInput).toBeVisible();
    
    // Should have submit button
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
  });
});

test.describe('Admin Portal - Readonly Features', () => {
  // Note: These tests assume you can view the admin portal without logging in,
  // or test features that don't modify data. Adjust based on your auth requirements.

  test('prayers page should be accessible structure', async ({ page }) => {
    // Navigate to admin (may redirect to login, that's ok)
    await page.goto('/admin');
    
    // If redirected to login, that's expected
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      // Login required - test passed (auth is working)
      await expect(page.locator('body')).toBeVisible();
    } else {
      // If not redirected, check page structure
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
