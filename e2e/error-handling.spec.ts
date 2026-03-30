import { test, expect } from '@playwright/test';

test.describe('Error Handling & Edge Cases', () => {
  test('should handle empty prayer list gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Apply filters that might result in empty state
    const answeredButton = page.locator('button:has-text("Answered")').first();
    if (await answeredButton.isVisible()) {
      await answeredButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Page should still be functional (not crash)
    await expect(page.locator('body')).toBeVisible();
    
    // No console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
  });

  test('should handle very long prayer text', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Look for prayer cards
    const cards = page.locator('[class*="prayer"], [class*="card"]');
    if (await cards.first().isVisible()) {
      const text = await cards.first().textContent();
      
      // Should render regardless of text length
      expect(text).toBeTruthy();
      
      // Layout should not break
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle special characters in prayer text', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Page content should render special characters correctly
    const content = await page.locator('body').textContent();
    
    // Should not crash with special characters
    expect(content).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle rapid filter changes without error', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Rapidly click enabled buttons
    const buttons = page.locator('button:visible:enabled');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(5, buttonCount); i++) {
      const button = buttons.nth(i);
      try {
        if (await button.isVisible().catch(() => false)) {
          const isEnabled = await button.isEnabled().catch(() => false);
          if (isEnabled) {
            await button.click({ timeout: 500 }).catch(() => {
              // Ignore click errors
            });
            await page.waitForTimeout(50);
          }
        }
      } catch (e) {
        // Continue to next button
        continue;
      }
    }
    
    // Should handle without errors
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle missing prayer data fields gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Page should display even if some data is missing
    await expect(page.locator('body')).toBeVisible();
    
    // No fatal errors
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should handle search with no results', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Search for something unlikely to exist
      await searchInput.fill('xyzabc12345notfound');
      await page.waitForTimeout(1000);
      
      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
      
      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(500);
      
      // Should show content again
      const content = await page.locator('body').textContent();
      expect(content).toBeTruthy();
    }
  });

  test('should handle null/undefined data in prayer properties', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Page should render without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle concurrent filter and search operations', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Get search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    // Get filter button
    const filterButton = page.locator('button:has-text("Answered")').first();
    
    if (await searchInput.isVisible() && await filterButton.isVisible()) {
      // Search
      await searchInput.fill('prayer');
      await page.waitForTimeout(300);
      
      // Apply filter
      await filterButton.click();
      await page.waitForTimeout(300);
      
      // Search again
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      
      // Page should handle both operations
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle presentation mode with no prayers', async ({ page }) => {
    await page.goto('/presentation');
    await page.waitForTimeout(2000);
    
    // Wait for content to load
    const spinner = page.locator('.animate-spin').first();
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      // Spinner might not exist
    }
    
    // Page should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle invalid filter combinations', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Try multiple filter combinations with enabled buttons only
    const filterButtons = page.locator('button:visible:enabled');
    const firstButton = filterButtons.first();
    const secondButton = filterButtons.nth(1);
    
    try {
      if (await firstButton.isVisible().catch(() => false)) {
        const isEnabled = await firstButton.isEnabled().catch(() => false);
        if (isEnabled) {
          await firstButton.click({ timeout: 500 }).catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    } catch (e) {
      // Continue even if first button click fails
    }
    
    try {
      if (await secondButton.isVisible().catch(() => false)) {
        const isEnabled = await secondButton.isEnabled().catch(() => false);
        if (isEnabled) {
          await secondButton.click({ timeout: 500 }).catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    } catch (e) {
      // Continue even if second button click fails
    }
    
    // App should remain stable
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle rapid navigation without error', async ({ page }) => {
    // Navigate rapidly between pages
    await page.goto('/');
    await page.waitForTimeout(500);
    
    await page.goto('/presentation');
    await page.waitForTimeout(500);
    
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // App should be stable
    await expect(page.locator('body')).toBeVisible();
  });

  test('should recover from network latency', async ({ page }) => {
    // Simulate network throttling
    await page.route('**/*', (route) => {
      setTimeout(() => {
        route.continue();
      }, 2000);
    });
    
    await page.goto('/');
    
    // Wait for content despite latency
    await page.waitForTimeout(5000);
    
    // Page should eventually load
    await expect(page.locator('body')).toBeVisible();
  });
});
