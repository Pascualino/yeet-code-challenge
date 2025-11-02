import { test, expect } from './fixtures';
import { createHeaders, generateActionId, TEST_CONFIG } from './test-helpers';

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

  test('Scenario E: Insufficient Funds', async ({ newUserWithBalance, request }) => {
    const userId = await newUserWithBalance(1000);
    
    // Try to bet more than available balance
    const body = JSON.stringify({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032911004723918',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: generateActionId('bet'),
          amount: 5000,
        },
      ],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers:createHeaders(body),
      data: body,
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    expect(responseBody.code).toBe(100);
    expect(responseBody.message).toContain('Player has not enough funds to process an action');
  });

  test('404 Not Found - Non-existent route', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/non-existent-route`);
    
    expect(response.status()).toBe(404);
  });

  test('400 Bad Request - Missing user_id in process request', async ({ request }) => {
    const body = JSON.stringify({
      currency: 'USD',
      game: 'test',
      actions: [],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.message).toContain('user_id');
  });

  test('400 Bad Request - Invalid action: bet without amount', async ({ request }) => {
    const body = JSON.stringify({
      user_id: 'test-user',
      currency: 'USD',
      game: 'test',
      game_id: 'test-game',
      actions: [
        {
          action: 'bet',
          action_id: generateActionId('bet'),
          // Missing amount
        },
      ],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.message).toContain('amount');
  });

  test('400 Bad Request - RTP endpoint: missing from parameter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/aggregator/takehome/rtp?to=2024-01-02T00:00:00Z`);
    
    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.message).toContain('from');
  });
});

