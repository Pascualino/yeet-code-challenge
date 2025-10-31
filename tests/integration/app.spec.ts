import { test, expect } from '@playwright/test';

test.describe('App Integration Tests', () => {
  test('should display Hello World on homepage', async ({ page }) => {
    const response = await page.goto('/');
    
    // Check that the page loads successfully
    expect(response?.status()).toBe(200);
    
    // Check that the response contains "Hello World!"
    const content = await page.content();
    expect(content).toContain('Hello World!');
  });

  test('should return 404 for non-existent route', async ({ page }) => {
    const response = await page.goto('/non-existent-route');
    
    // Check that we get a 404 response
    expect(response?.status()).toBe(404);
  });
});

