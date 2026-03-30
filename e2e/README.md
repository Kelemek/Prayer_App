# E2E Tests with Playwright

This directory contains end-to-end tests for the Prayer App using Playwright.

## Overview

The test suite focuses on **read-only functionality** to safely test against the production Supabase environment:

- ✅ Home page loads and displays prayers
- ✅ Presentation mode navigation and filtering
- ✅ Form validation (without data submission)
- ✅ Admin login page structure
- ✅ Theme switching and UI interactions

## Running Tests

### Run all tests
```bash
npm run e2e
```

### Run tests with UI (interactive)
```bash
npm run e2e:ui
```

### Debug tests
```bash
npm run e2e:debug
```

### View test report
```bash
npm run e2e:report
```

### Run specific test file
```bash
npx playwright test e2e/home.spec.ts
```

### Run in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
```

## Test Structure

```
e2e/
├── home.spec.ts          # Home page and prayer listing tests
├── presentation.spec.ts   # Presentation mode tests
└── admin.spec.ts         # Admin portal tests
```

## How Tests Work

Tests are **read-only** and safe to run against production:

1. **No data creation** - Tests don't submit forms or create prayers
2. **No data modification** - Tests only view and interact with existing data
3. **UI interaction testing** - Tests verify forms show validation errors, navigation works, etc.
4. **Idempotent** - Tests can run multiple times without side effects

## Configuration

See `playwright.config.ts` for configuration details:

- **Base URL**: `http://localhost:4200` (local development)
- **Timeout**: 30 seconds per test
- **Retries**: 2 in CI, 0 locally
- **Screenshot**: Only on failure
- **Trace**: On first retry

### Environment Variables

```bash
BASE_URL=http://localhost:4200     # URL to test against
CI=true                             # Run in CI mode
```

## Adding New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Use the existing tests as templates
3. Keep tests read-only (no submissions)
4. Use descriptive test names

Example:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path');
    
    // Interact with page
    await page.click('button:has-text("Click me")');
    
    // Verify behavior
    await expect(page.locator('div')).toContainText('Expected text');
  });
});
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

See `.github/workflows/e2e-tests.yml` for workflow configuration.

Test artifacts (report, screenshots) are uploaded for 30 days.

## Debugging Tests

### View element selectors
```bash
npx playwright test --debug
# Use Playwright Inspector to inspect elements
```

### Generate selectors
```bash
npx playwright codegen http://localhost:4200
# Inspector shows locators for clicked elements
```

### View videos/screenshots
Test failures automatically capture screenshots and video. View them in:
```bash
npm run e2e:report
```

## Best Practices

1. **Use semantic selectors** - Prefer `[role="button"]` over arbitrary classes
2. **Wait for content** - Use `page.waitForTimeout()` or wait for elements
3. **Keep tests independent** - Each test should work alone
4. **Avoid hardcoding delays** - Use `waitFor` methods instead
5. **Test real user behavior** - Think about what users actually do

## Troubleshooting

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if app is running on correct port
- Add debug logs with `console.log()`

### Tests fail in CI but pass locally
- CI runs slower - increase timeouts
- Check `BASE_URL` environment variable
- Verify all dependencies installed

### Flaky tests
- Add explicit waits for elements
- Avoid checking too-specific UI state
- Use `waitFor` with appropriate timeout

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Angular Testing Guide](https://angular.io/guide/testing)
