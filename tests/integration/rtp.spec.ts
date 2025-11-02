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
    expect(user1Data.total_win).toBe(stats1.totalWin);

    // Verify second user
    expect(user2Data).toBeDefined();
    expect(user2Data.currency).toBe('USD');
    expect(user2Data.rounds).toBe(stats2.rounds);
    expect(user2Data.total_bet).toBe(stats2.totalBet);
    expect(user2Data.total_win).toBe(stats2.totalWin);

    // Verify RTP calculations
    const expectedRtp1 = (stats1.totalWin) / stats1.totalBet;
    const expectedRtp2 = (stats2.totalWin) / stats2.totalBet;
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

    const expectedRtp = (stats.totalWin) / stats.totalBet;

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
    expect(rtpData.total_win).toBe(stats.totalWin);
    expect(Math.abs(rtpData.rtp - expectedRtp)).toBeLessThan(0.00001);
  });

  test.describe('Global stats with rollbacks', () => {
    test('Complex scenario with pre and post rollbacks', async ({
    newUserWithBalance,
    processActions,
    request,
  }) => {
    // Capture the actual test start time
    const testStartTime = new Date();

    // Create multiple users for a realistic casino-wide scenario
    const userId1 = await newUserWithBalance(50000);
    const userId2 = await newUserWithBalance(30000);
    const userId3 = await newUserWithBalance(40000);

    // User 1: Multiple bets/wins with post-rollbacks
    // Operation 1: 3 bets, 2 wins
    const bet1_1 = generateActionId('user1-bet1-1');
    const bet1_2 = generateActionId('user1-bet1-2');
    const bet1_3 = generateActionId('user1-bet1-3');
    const win1_1 = generateActionId('user1-win1-1');
    const win1_2 = generateActionId('user1-win1-2');

    await processActions({
      user_id: userId1,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-1',
      actions: [
        { action: 'bet', action_id: bet1_1, amount: 100 },
        { action: 'bet', action_id: bet1_2, amount: 200 },
        { action: 'bet', action_id: bet1_3, amount: 150 },
        { action: 'win', action_id: win1_1, amount: 120 },
        { action: 'win', action_id: win1_2, amount: 250 },
      ],
    });

    // Operation 2: Rollback one bet and one win (post-rollbacks)
    const rollback1_1 = generateActionId('user1-rollback1-1'); // Rollback bet1_2 (200)
    const rollback1_2 = generateActionId('user1-rollback1-2'); // Rollback win1_1 (120)

    await processActions({
      user_id: userId1,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-1',
      actions: [
        { action: 'rollback', action_id: rollback1_1, original_action_id: bet1_2 },
        { action: 'rollback', action_id: rollback1_2, original_action_id: win1_1 },
      ],
    });

    // Operation 3: More bets and wins
    const bet1_4 = generateActionId('user1-bet1-4');
    const bet1_5 = generateActionId('user1-bet1-5');
    const win1_3 = generateActionId('user1-win1-3');

    await processActions({
      user_id: userId1,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-1',
      actions: [
        { action: 'bet', action_id: bet1_4, amount: 300 },
        { action: 'bet', action_id: bet1_5, amount: 180 },
        { action: 'win', action_id: win1_3, amount: 350 },
      ],
    });

    // User 2: Pre-rollbacks and bets/wins
    // Operation 1: Pre-rollback for a future bet and win
    const preRollbackBet2 = generateActionId('user2-prerollback-bet');
    const preRollbackWin2 = generateActionId('user2-prerollback-win');
    const futureBet2_1 = generateActionId('user2-bet2-1');
    const futureWin2_1 = generateActionId('user2-win2-1');

    await processActions({
      user_id: userId2,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-2',
      actions: [
        { action: 'rollback', action_id: preRollbackBet2, original_action_id: futureBet2_1 },
        { action: 'rollback', action_id: preRollbackWin2, original_action_id: futureWin2_1 },
      ],
    });

    // Operation 2: The bets/wins that were pre-rolled back
    await processActions({
      user_id: userId2,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-2',
      actions: [
        { action: 'bet', action_id: futureBet2_1, amount: 150 }, // Pre-rolled back
        { action: 'win', action_id: futureWin2_1, amount: 200 }, // Pre-rolled back
      ],
    });

    // Operation 3: Regular bets and wins
    const bet2_2 = generateActionId('user2-bet2-2');
    const bet2_3 = generateActionId('user2-bet2-3');
    const win2_2 = generateActionId('user2-win2-2');

    await processActions({
      user_id: userId2,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-2',
      actions: [
        { action: 'bet', action_id: bet2_2, amount: 175 },
        { action: 'bet', action_id: bet2_3, amount: 125 },
        { action: 'win', action_id: win2_2, amount: 280 },
      ],
    });

    // Operation 4: Rollback some actions (post-rollbacks)
    const rollback2_1 = generateActionId('user2-rollback2-1'); // Rollback bet2_2 (175)
    const rollback2_2 = generateActionId('user2-rollback2-2'); // Rollback win2_2 (280)

    await processActions({
      user_id: userId2,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-2',
      actions: [
        { action: 'rollback', action_id: rollback2_1, original_action_id: bet2_2 },
        { action: 'rollback', action_id: rollback2_2, original_action_id: win2_2 },
      ],
    });

    // User 3: Mix of bets, wins, and rollbacks in same batch
    const bet3_1 = generateActionId('user3-bet3-1');
    const bet3_2 = generateActionId('user3-bet3-2');
    const win3_1 = generateActionId('user3-win3-1');

    await processActions({
      user_id: userId3,
      currency: 'USD',
      game: 'test:rtp-rollback',
      game_id: 'rtp-test-game-3',
      actions: [
        { action: 'bet', action_id: bet3_1, amount: 250 },
        { action: 'bet', action_id: bet3_2, amount: 190 },
        { action: 'win', action_id: win3_1, amount: 320 },
      ],
    });

    // Capture the actual test end time
    const testEndTime = new Date();

    // Now get the RTP report with global_stats using actual test time range
    const fromDate = testStartTime.toISOString();
    const toDate = testEndTime.toISOString();
    const response = await request.get(
      `${BASE_URL}/aggregator/takehome/rtp?from=${fromDate}&to=${toDate}`,
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Verify global_stats exists
    expect(body).toHaveProperty('global_stats');
    const globalStats = body.global_stats;

    // Calculate expected totals (excluding initial balances, but INCLUDING rolled back actions)
    // Note: Pre-rollbacks make subsequent actions noop (amount 0), so they don't count
    
    // User 1 bets: 100 + 200 + 150 + 300 + 180 = 930 (all bets, including rolled back ones)
    // User 1 wins: 120 + 250 + 350 = 720 (all wins, including rolled back ones)
    
    // User 2: 
    // - futureBet2_1 (150) was pre-rolled back, so it's noop (0) - doesn't count
    // - futureWin2_1 (200) was pre-rolled back, so it's noop (0) - doesn't count
    // - bets: 175 + 125 = 300 (pre-rolled back bet doesn't count)
    // - wins: 280 (pre-rolled back win doesn't count)
    // - Pre-rollbacks themselves don't count in rollback totals (action was never processed with amount > 0)
    
    // User 3 bets: 250 + 190 = 440
    // User 3 wins: 320

    // Total bets: 930 + 300 + 440 = 1670 (includes all bets except pre-rolled back ones)
    // Total wins: 720 + 280 + 320 = 1320 (includes all wins except pre-rolled back ones)
    // Total rounds: 5 (user1) + 2 (user2, excluding noop bet) + 2 (user3) = 9

    // Rollback totals (only post-rollbacks, pre-rollbacks don't count):
    // Rollback bets (negative amounts): 200 (bet1_2) + 175 (bet2_2) = 375
    // Rollback wins (positive amounts): 120 (win1_1) + 280 (win2_2) = 400

    expect(globalStats.total_rounds).toBe(10);
    expect(globalStats.total_bet).toBe(1670);
    expect(globalStats.total_win).toBe(1320);
    expect(globalStats.total_rtp).toBeCloseTo(1320 / 1670, 5);
    expect(globalStats.total_rollback_bet).toBe(375); // Sum of absolute values of negative rollback amounts (post-rollbacks only)
    expect(globalStats.total_rollback_win).toBe(400); // Sum of positive rollback amounts (post-rollbacks only)
    });
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