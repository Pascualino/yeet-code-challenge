import { test, expect } from './fixtures';
import { TEST_CONFIG, generateActionId } from './test-helpers';
import { sum } from './utils/math';

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

  test('Per-user RTP with real data - multiple bets and wins', async ({
    newUserWithBalance,
    processActions,
    request,
  }) => {
    // Create a user with initial balance (this creates a win action with initialBalance)
    const initialBalance = 100000;
    const userId = await newUserWithBalance(initialBalance);
    const gameId = 'rtp-test-game';

    // Place 30 bets of varying amounts
    const betAmounts = [100, 200, 150, 300, 250, 175, 125, 225, 275, 325, 
                        110, 210, 160, 310, 260, 185, 135, 235, 285, 335,
                        120, 220, 170, 320, 270, 195, 145, 245, 295, 345];
    
    for (let i = 0; i < betAmounts.length; i++) {
      await processActions({
        user_id: userId,
        currency: 'USD',
        game: 'test:rtp',
        game_id: gameId,
        actions: [
          {
            action: 'bet',
            action_id: generateActionId(`bet-${i}`),
            amount: betAmounts[i],
          },
        ],
      });
    }

    // Place 25 wins of varying amounts
    const winAmounts = [150, 250, 200, 350, 300, 225, 175, 275, 325, 375,
                        160, 260, 210, 360, 310, 235, 185, 285, 335, 385,
                        170, 270, 220, 370, 320];
    
    for (let i = 0; i < winAmounts.length; i++) {
      await processActions({
        user_id: userId,
        currency: 'USD',
        game: 'test:rtp',
        game_id: gameId,
        actions: [
          {
            action: 'win',
            action_id: generateActionId(`win-${i}`),
            amount: winAmounts[i],
          },
        ],
      });
    }

    const expectedRtp = (sum(winAmounts) + initialBalance) / sum(betAmounts);

    const now = new Date();
    const fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp/${encodeURIComponent(userId)}?from=${fromDate}&to=${toDate}`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveLength(1);

    const rtpData = body.data[0];
    expect(rtpData.user_id).toBe(userId);
    expect(rtpData.currency).toBe('USD');
    expect(rtpData.rounds).toBe(betAmounts.length);
    expect(rtpData.total_bet).toBe(sum(betAmounts));
    expect(rtpData.total_win).toBe(sum(winAmounts) + initialBalance);
    expect(Math.abs(rtpData.rtp - expectedRtp)).toBeLessThan(0.00001);
  });
});

