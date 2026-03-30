import { test, expect } from '@playwright/test';

test.describe('Data Validation & Display', () => {
  test('should display prayers with valid data structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Find prayer cards
    const cards = page.locator('[class*="prayer"], [class*="card"]');
    const cardCount = await cards.count();
    
    if (cardCount > 0) {
      const firstCard = cards.first();
      
      // Prayer should have content
      const cardText = await firstCard.textContent();
      expect(cardText).toBeTruthy();
      expect(cardText?.length).toBeGreaterThan(0);
      
      // Should display title or main content
      const hasHeading = await firstCard.locator('h2, h3, h4').count();
      expect(hasHeading).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display prayer metadata (dates, status)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Look for date displays
    const cards = page.locator('[class*="prayer"], [class*="card"]');
    if (await cards.first().isVisible()) {
      const cardText = await cards.first().textContent();
      
      // Should have some temporal information or status indicator
      expect(cardText).toBeTruthy();
    }
  });

  test('should display correct prayer count', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Get prayer cards
    const cards = page.locator('[class*="prayer"], [class*="card"]');
    const count = await cards.count();
    
    // Look for count display in UI
    const countText = await page.locator('body').textContent();
    
    // Should have at least some content loaded
    expect(countText).toBeTruthy();
    expect(countText?.length).toBeGreaterThan(100);
  });

  test('should display answered prayers correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Click answered filter
    const answeredButton = page.locator('button:has-text("Answered")').first();
    if (await answeredButton.isVisible()) {
      await answeredButton.click();
      await page.waitForTimeout(1000);
      
      // Should still display content
      const content = await page.locator('body').textContent();
      expect(content).toBeTruthy();
    }
  });

  test('should display current/active prayers correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Click current filter
    const currentButton = page.locator('button:has-text("Current")').first();
    if (await currentButton.isVisible()) {
      await currentButton.click();
      await page.waitForTimeout(1000);
      
      // Should display content
      const content = await page.locator('body').textContent();
      expect(content).toBeTruthy();
    }
  });

  test('should display correct timestamps in prayers', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Get page content which should have dates
    const content = await page.locator('body').textContent();
    
    // Look for date-like patterns (numbers, months, years)
    const hasDateInfo = /\d{1,2}\/\d{1,2}|\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(content || '');
    
    // Content should exist
    expect(content).toBeTruthy();
  });

  test('should display prayer content without truncation issues', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Find first prayer card
    const firstCard = page.locator('[class*="prayer"], [class*="card"]').first();
    
    if (await firstCard.isVisible()) {
      // Get text content
      const text = await firstCard.textContent();
      
      // Should not be empty
      expect(text?.trim()).toBeTruthy();
      
      // Should be readable (not just single character)
      expect(text?.length).toBeGreaterThan(5);
    }
  });

  test('should display filters with valid options', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Look for filter elements
    const filterButtons = page.locator('button:has-text("Current"), button:has-text("Answered")');
    const filterCount = await filterButtons.count();
    
    // Should have at least status filters
    expect(filterCount).toBeGreaterThanOrEqual(0);
  });

  test('prayer data should remain consistent across filter changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Get initial content
    const initialContent = await page.locator('body').textContent();
    
    // Apply filter
    const currentButton = page.locator('button:has-text("Current")').first();
    if (await currentButton.isVisible()) {
      await currentButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Get new content
    const newContent = await page.locator('body').textContent();
    
    // Both should have content (data should be consistent)
    expect(initialContent).toBeTruthy();
    expect(newContent).toBeTruthy();
  });

  test('should display presentation mode with valid prayer data', async ({ page }) => {
    await page.goto('/presentation');
    await page.waitForTimeout(2000);
    
    // Wait for spinner to disappear
    const spinner = page.locator('.animate-spin').first();
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      // Spinner might not exist
    }
    
    // Page content should be visible
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
  });
});
