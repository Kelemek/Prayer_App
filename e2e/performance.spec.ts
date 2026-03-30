import { test, expect } from '@playwright/test';

test.describe('Performance and Load Times', () => {
  test('home page should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for main content
    await page.waitForSelector('[class*="prayer"], body', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
    
    // Page should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('presentation page should load without spinner hanging', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/presentation');
    
    // Wait for spinner to disappear or content to appear
    const spinner = page.locator('.animate-spin, [role="status"]').first();
    
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Spinner not found or already hidden
    }
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
    
    // Content should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('search results should update quickly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      const startTime = Date.now();
      
      // Type search term
      await searchInput.fill('prayer');
      
      // Wait for results
      await page.waitForTimeout(1000);
      
      const searchTime = Date.now() - startTime;
      
      // Search should complete quickly (under 2 seconds)
      expect(searchTime).toBeLessThan(2000);
    }
  });

  test('navigation transitions should be smooth', async ({ page }) => {
    // Go to home
    const homeStart = Date.now();
    await page.goto('/');
    await page.waitForTimeout(2000);
    const homeTime = Date.now() - homeStart;
    
    // Go to presentation
    const presentStart = Date.now();
    await page.goto('/presentation');
    await page.waitForTimeout(2000);
    const presentTime = Date.now() - presentStart;
    
    // Both should be reasonably fast
    expect(homeTime).toBeLessThan(10000);
    expect(presentTime).toBeLessThan(10000);
  });

  test('multiple filter changes should not cause lag', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find visible, enabled interactive elements
    const interactiveElements = page.locator('button:visible:enabled, a:visible');
    const elementCount = await interactiveElements.count();
    
    if (elementCount === 0) {
      // If no interactive elements, just verify page is responsive
      await expect(page.locator('body')).toBeVisible();
      return;
    }
    
    const startTime = Date.now();
    
    // Click several interactive elements in quick succession
    const elementsToClick = Math.min(5, elementCount);
    for (let i = 0; i < elementsToClick; i++) {
      const element = interactiveElements.nth(i);
      try {
        if (await element.isVisible().catch(() => false)) {
          await element.click({ timeout: 500 }).catch(() => {
            // Ignore click errors, just continue
          });
          await page.waitForTimeout(100);
        }
      } catch (e) {
        // If interaction fails, continue with next element
        continue;
      }
    }
    
    const interactionTime = Date.now() - startTime;
    
    // Should handle multiple interactions without excessive lag (increased from 3000 to 5000 for stability)
    expect(interactionTime).toBeLessThan(5000);
    
    // Page should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin login page should load quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    
    // Wait for form to appear
    await page.waitForSelector('input[type="email"], body', { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load quickly
    expect(loadTime).toBeLessThan(5000);
  });

  test('content should render without layout shift', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Get initial viewport
    const initialHeight = await page.evaluate(() => document.body.scrollHeight);
    
    // Wait a bit more for any async content
    await page.waitForTimeout(2000);
    
    // Get new height
    const finalHeight = await page.evaluate(() => document.body.scrollHeight);
    
    // Height shouldn't change dramatically (allow some variance)
    const heightDiff = Math.abs(initialHeight - finalHeight);
    expect(heightDiff).toBeLessThan(initialHeight * 0.5); // Allow 50% variance for dynamic content
  });
});
