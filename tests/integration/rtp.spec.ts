import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './test-helpers';

const { BASE_URL } = TEST_CONFIG;

/**
 * RTP Report Endpoints
 * - Casino-wide RTP: GET /aggregator/takehome/rtp
 * - Per-user RTP: GET /aggregator/takehome/rtp/:user_id
 */

test.describe('RTP Report', () => {
  test('Casino-wide RTP returns all users', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    // Verify structure of first user
    const firstUser = body.data[0];
    expect(firstUser).toHaveProperty('user_id');
    expect(firstUser).toHaveProperty('currency');
    expect(firstUser).toHaveProperty('rounds');
    expect(firstUser).toHaveProperty('total_bet');
    expect(firstUser).toHaveProperty('total_win');
    expect(firstUser).toHaveProperty('rtp');

    // Verify data types
    expect(typeof firstUser.user_id).toBe('string');
    expect(typeof firstUser.currency).toBe('string');
    expect(typeof firstUser.rounds).toBe('number');
    expect(typeof firstUser.total_bet).toBe('number');
    expect(typeof firstUser.total_win).toBe('number');
    expect(typeof firstUser.rtp).toBe('number');
  });

  test('Casino-wide RTP returns expected mock data', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z`,
    );

    const body = await response.json();
    
    // Verify we have 3 mock users
    expect(body.data).toHaveLength(3);

    // Verify specific users are present
    const userIds = body.data.map((u: any) => u.user_id);
    expect(userIds).toContain('8|USDT|USD');
    expect(userIds).toContain('42|BTC|USD');
    expect(userIds).toContain('99|ETH|EUR');
  });

  test('Per-user RTP returns single user data', async ({ request }) => {
    const userId = '8|USDT|USD';
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp/${encodeURIComponent(userId)}?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);

    // Verify it's the correct user
    expect(body.data[0].user_id).toBe(userId);
    expect(body.data[0]).toHaveProperty('currency');
    expect(body.data[0]).toHaveProperty('rounds');
    expect(body.data[0]).toHaveProperty('total_bet');
    expect(body.data[0]).toHaveProperty('total_win');
    expect(body.data[0]).toHaveProperty('rtp');
  });

  test('Per-user RTP returns correct user_id in response', async ({ request }) => {
    const userId = '42|BTC|USD';
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp/${encodeURIComponent(userId)}?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z`,
    );

    const body = await response.json();
    
    // Verify the returned user_id matches the requested one
    expect(body.data[0].user_id).toBe(userId);
  });

  test('RTP values are within valid range (0 to 1)', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z`,
    );

    const body = await response.json();

    for (const user of body.data) {
      if (user.rtp !== null) {
        expect(user.rtp).toBeGreaterThanOrEqual(0);
        expect(user.rtp).toBeLessThanOrEqual(1);
      }
    }
  });

  test('RTP calculation is consistent with total_bet and total_win', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z`,
    );

    const body = await response.json();

    for (const user of body.data) {
      if (user.rtp !== null && user.total_bet > 0) {
        const calculatedRtp = user.total_win / user.total_bet;
        // Allow reasonable floating point differences (0.1%)
        expect(Math.abs(user.rtp - calculatedRtp)).toBeLessThan(0.001);
      }
    }
  });
});

