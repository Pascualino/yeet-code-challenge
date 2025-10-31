import { test, expect } from '@playwright/test';
import { TEST_CONFIG, createHeaders } from './test-helpers';

/**
 * Acceptance Scenarios: A, E
 * - Scenario A: Missing Authorization → 403
 * - Scenario E: Insufficient Funds
 */

const { BASE_URL, ENDPOINT } = TEST_CONFIG;

test.describe('Error Handling', () => {
  test('Scenario A: Missing Authorization → 403', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      data: body,
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).message).toContain('Missing Authorization header');
  });

  test('Scenario A: Invalid HMAC signature → 403', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'HMAC-SHA256 invalid-signature-here',
      },
      data: body,
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).message).toContain('Invalid HMAC signature');
  });

  test.skip('Scenario E: Insufficient Funds', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032911004723918',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: '6c1e98e8-8e93-4856-b6ef-8b2ddc6c4cbc',
          amount: 74322202, // Exceeds balance
        },
      ],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    // Should return 4xx error
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('code', 100);
    expect(responseBody).toHaveProperty('message');
    expect(responseBody.message).toContain('not enough funds');
  });

  test('404 Not Found - Non-existent route', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/non-existent-route`);
    
    expect(response.status()).toBe(404);
  });
});

