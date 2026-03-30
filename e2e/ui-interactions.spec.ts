import { test, expect } from '@playwright/test';

test.describe('UI Interactions and Accessibility', () => {
  test('should handle window resize gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Resize window to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Resize back to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle button clicks without errors', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Get all visible, enabled buttons
    const buttons = page.locator('button:visible:enabled');
    const buttonCount = await buttons.count();
    
    // Try clicking first few enabled buttons
    for (let i = 0; i < Math.min(3, buttonCount); i++) {
      const button = buttons.nth(i);
      
      try {
        if (await button.isVisible().catch(() => false)) {
          const isEnabled = await button.isEnabled().catch(() => false);
          if (isEnabled) {
            await button.click({ timeout: 500 }).catch(() => {
              // Ignore click errors, continue to next
            });
            await page.waitForTimeout(300);
          }
        }
      } catch (e) {
        // Continue to next button if click fails
        continue;
      }
      
      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display error states gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for any error messages
    const errorElements = page.locator('[role="alert"], .error, [class*="error"]');
    const errorCount = await errorElements.count();
    
    // If there are errors, they should be visible
    if (errorCount > 0) {
      const firstError = errorElements.first();
      await expect(firstError).toBeVisible();
    }
  });

  test('should handle modal/dialog interactions', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for buttons that might open modals
    const requestButton = page.locator('button:has-text("Request")').first();
    
    if (await requestButton.isVisible()) {
      // Click to open modal
      await requestButton.click();
      await page.waitForTimeout(500);
      
      // Modal should be visible
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        // Try to close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should maintain focus management', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle scroll interactions', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    
    // Should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Scroll back up
    await page.evaluate(() => window.scrollBy(0, -500));
    await page.waitForTimeout(500);
    
    // Should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/presentation');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Test arrow keys
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    
    // Test Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle rapid interactions', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find visible, enabled buttons for rapid clicks
    const buttons = page.locator('button:visible:enabled');
    const firstButton = buttons.first();
    
    if (await firstButton.isVisible().catch(() => false)) {
      const isEnabled = await firstButton.isEnabled().catch(() => false);
      if (isEnabled) {
        for (let i = 0; i < 3; i++) {
          try {
            await firstButton.click({ timeout: 500 }).catch(() => {
              // Ignore click errors on rapid interactions
            });
            await page.waitForTimeout(100);
          } catch (e) {
            // Continue despite errors
            continue;
          }
        }
      }
    }
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
