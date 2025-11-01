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
  test('Casino-wide RTP with multiple users', async ({
    newUserWithBalance,
    processActions,
    request,
  }) => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Create first user with bets and wins
    const userId1 = await newUserWithBalance(50000);
    const betAmounts1 = [100, 200, 300];
    const winAmounts1 = [150, 250];
    const stats1 = await placeBetsAndWins(
      processActions,
      userId1,
      betAmounts1,
      winAmounts1,
    );

    // Create second user with different bets and wins
    const userId2 = await newUserWithBalance(30000);
    const betAmounts2 = [50, 75, 100, 125];
    const winAmounts2 = [80, 120, 150];
    const stats2 = await placeBetsAndWins(
      processActions,
      userId2,
      betAmounts2,
      winAmounts2,
    );

    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp?from=${fromDate}&to=${toDate}`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);

    // Find our test users in the results
    const user1Data = body.data.find((u: any) => u.user_id === userId1);
    const user2Data = body.data.find((u: any) => u.user_id === userId2);

    // Verify first user
    expect(user1Data).toBeDefined();
    expect(user1Data.currency).toBe('USD');
    expect(user1Data.rounds).toBe(stats1.rounds);
    expect(user1Data.total_bet).toBe(stats1.totalBet);
    expect(user1Data.total_win).toBe(stats1.totalWin + 50000); // Include initial balance

    // Verify second user
    expect(user2Data).toBeDefined();
    expect(user2Data.currency).toBe('USD');
    expect(user2Data.rounds).toBe(stats2.rounds);
    expect(user2Data.total_bet).toBe(stats2.totalBet);
    expect(user2Data.total_win).toBe(stats2.totalWin + 30000); // Include initial balance

    // Verify RTP calculations
    const expectedRtp1 = (stats1.totalWin + 50000) / stats1.totalBet;
    const expectedRtp2 = (stats2.totalWin + 30000) / stats2.totalBet;
    expect(Math.abs(user1Data.rtp - expectedRtp1)).toBeLessThan(0.00001);
    expect(Math.abs(user2Data.rtp - expectedRtp2)).toBeLessThan(0.00001);
  });

  test('Per-user RTP with real data - multiple bets and wins', async ({
    newUserWithBalance,
    processActions,
    request,
  }) => {
    const initialBalance = 100000;
    const userId = await newUserWithBalance(initialBalance);

    // Place 30 bets of varying amounts
    const betAmounts = [
      100, 200, 150, 300, 250, 175, 125, 225, 275, 325, 110, 210, 160, 310,
      260, 185, 135, 235, 285, 335, 120, 220, 170, 320, 270, 195, 145, 245,
      295, 345,
    ];

    // Place 25 wins of varying amounts
    const winAmounts = [
      150, 250, 200, 350, 300, 225, 175, 275, 325, 375, 160, 260, 210, 360,
      310, 235, 185, 285, 335, 385, 170, 270, 220, 370, 320,
    ];

    const stats = await placeBetsAndWins(
      processActions,
      userId,
      betAmounts,
      winAmounts,
    );

    const expectedRtp = (stats.totalWin + initialBalance) / stats.totalBet;

    const now = new Date();
    const fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp/${encodeURIComponent(userId)}?from=${fromDate}&to=${toDate}`,
    );

    expect(response.status()).toBe(200);

    const rtpData = await response.json();
    expect(rtpData.user_id).toBe(userId);
    expect(rtpData.currency).toBe('USD');
    expect(rtpData.rounds).toBe(stats.rounds);
    expect(rtpData.total_bet).toBe(stats.totalBet);
    expect(rtpData.total_win).toBe(stats.totalWin + initialBalance);
    expect(Math.abs(rtpData.rtp - expectedRtp)).toBeLessThan(0.00001);
  });
});

async function placeBetsAndWins(
  processActions: (params: any) => Promise<any>,
  userId: string,
  betAmounts: number[],
  winAmounts: number[],
): Promise<{ rounds: number; totalBet: number; totalWin: number }> {
  // Place bets
  for (let i = 0; i < betAmounts.length; i++) {
    await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'test:rtp',
      game_id: 'test-rtp-game',
      actions: [
        {
          action: 'bet',
          action_id: generateActionId(`bet-${i}`),
          amount: betAmounts[i],
        },
      ],
    });
  }

  // Place wins
  for (let i = 0; i < winAmounts.length; i++) {
    await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'test:rtp',
      game_id: 'test-rtp-game',
      actions: [
        {
          action: 'win',
          action_id: generateActionId(`win-${i}`),
          amount: winAmounts[i],
        },
      ],
    });
  }

  return {
    rounds: betAmounts.length,
    totalBet: sum(betAmounts),
    totalWin: sum(winAmounts),
  };
}