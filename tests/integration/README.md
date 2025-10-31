# Integration Tests with Playwright

This directory contains integration tests using Playwright for end-to-end testing of the NestJS application.

## Running Tests

**Note:** Make sure the NestJS application is running before executing the tests:
```bash
npm run start:dev
```

Then in another terminal:

### Run all integration tests (headless mode)
```bash
npm run test:integration
```

### Run tests with UI mode (interactive)
```bash
npm run test:integration:ui
```

### Run tests in headed mode (see the browser)
```bash
npm run test:integration:headed
```

### View test report
```bash
npm run test:integration:report
```

## Writing Tests

Tests are written using Playwright's test runner. Example:

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Expected Title/);
});
```

## Configuration

The Playwright configuration is located in `playwright.config.ts` at the project root. It includes:

- **Web Server**: Automatically starts the NestJS dev server before running tests
- **Base URL**: http://localhost:3000
- **Browser**: Chromium (configurable for other browsers)
- **Parallel Execution**: Tests run in parallel for faster execution
- **Traces**: Captured on first retry for debugging

## Best Practices

1. **Use Page Objects**: For complex pages, consider using the Page Object Model
2. **Isolation**: Each test should be independent and not rely on others
3. **Cleanup**: Tests should clean up any data they create
4. **Selectors**: Use stable selectors (data-testid attributes) instead of CSS classes
5. **Waits**: Use Playwright's auto-waiting features instead of manual timeouts

