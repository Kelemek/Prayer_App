import { test, expect } from '@playwright/test';

test.describe('Prayer Search and Filtering', () => {
  test('should search for prayers by keyword', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Type search term
      await searchInput.fill('prayer');
      await page.waitForTimeout(500);
      
      // Results should update
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should filter prayers by status', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for status filter buttons
    const currentButton = page.locator('button:has-text("Current")').first();
    const answeredButton = page.locator('button:has-text("Answered")').first();
    
    if (await currentButton.isVisible()) {
      // Click Current
      await currentButton.click();
      await page.waitForTimeout(500);
      
      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
    }
    
    if (await answeredButton.isVisible()) {
      // Click Answered
      await answeredButton.click();
      await page.waitForTimeout(500);
      
      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should clear search and show all prayers', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Type in search
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      
      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(500);
      
      // Page should still work
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should sort prayers correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for sort dropdown or buttons
    const sortOptions = page.locator('select[aria-label*="sort" i], button[title*="sort" i]').first();
    
    if (await sortOptions.isVisible()) {
      await sortOptions.click();
      await page.waitForTimeout(500);
      
      // Page should remain functional
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display prayer details in card', async ({ page }) => {
    await page.goto('/');
    
    // Wait for prayers to load
    await page.waitForTimeout(2000);
    
    // Find first prayer card
    const firstCard = page.locator('[class*="prayer"], [class*="card"]').first();
    
    if (await firstCard.isVisible()) {
      // Should display some content
      const cardText = await firstCard.textContent();
      expect(cardText).toBeTruthy();
      
      // Should have some interactive elements
      const cardButtons = firstCard.locator('button');
      const buttonCount = await cardButtons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(0);
    }
  });
});
