import { test, expect } from './fixtures';
import { generateActionId, newUserId } from './test-helpers';

/**
 * Acceptance Scenarios: C, D, F
 * - Scenario C: Single Bet (No Win)
 * - Scenario D: Bet + Win in Same Request
 * - Scenario F: Bet Then Win (Separate Calls)
 */

test.describe('Transaction Operations', () => {
  test('Scenario C: Single Bet (No Win)', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(5000);

    const action_id = generateActionId('single-bet');
    const result = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032910245540510',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id,
          amount: 100,
        },
      ],
    });
    
    // Verify response structure
    expect(result).toHaveProperty('game_id', '1761032910245540510');
    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('balance');
    
    // Verify transaction
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toHaveProperty('action_id', action_id);
    expect(result.transactions[0]).toHaveProperty('tx_id');
    expect(result.transactions[0].tx_id).toBeTruthy();
    
    // Verify balance decreased
    expect(result.balance).toBe(5000 - 100);
  });

  test.skip('Scenario D: Bet + Win in Same Request', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    
    const result = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032910488163506',
      actions: [
        {
          action: 'bet',
          action_id: '7c8affbf-53fd-4fcc-b1ca-18118c5dd287',
          amount: 100,
        },
        {
          action: 'win',
          action_id: '86441c7a-560e-4501-b829-110af6a1b956',
          amount: 250,
        },
      ],
    });
    
    // Verify response structure
    expect(result).toHaveProperty('game_id', '1761032910488163506');
    expect(result.transactions).toHaveLength(2);
    
    // Verify bet transaction
    expect(result.transactions[0].action_id).toBe('7c8affbf-53fd-4fcc-b1ca-18118c5dd287');
    expect(result.transactions[0].tx_id).toBeTruthy();
    
    // Verify win transaction
    expect(result.transactions[1].action_id).toBe('86441c7a-560e-4501-b829-110af6a1b956');
    expect(result.transactions[1].tx_id).toBeTruthy();
    
    // Transactions should have different tx_ids
    expect(result.transactions[0].tx_id).not.toBe(result.transactions[1].tx_id);
    
    // Balance should reflect net change (+150: -100 bet + 250 win)
    expect(result.balance).toBe(10000 + 150);
  });

  test.skip('Scenario F: Bet Then Win (Separate Calls)', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    const gameId = '1761032911166149146';
    
    // Step 1: Place bet
    const betResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: gameId,
      actions: [
        {
          action: 'bet',
          action_id: '19bd35d5-50c3-4720-a402-145a46ab874c',
          amount: 100,
        },
      ],
    });
    
    expect(betResult).toHaveProperty('game_id', gameId);
    expect(betResult.transactions).toHaveLength(1);
    expect(betResult.transactions[0].action_id).toBe('19bd35d5-50c3-4720-a402-145a46ab874c');
    
    const balanceAfterBet = betResult.balance;

    // Step 2: Add win in separate call
    const winResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: gameId,
      finished: true,
      actions: [
        {
          action: 'win',
          action_id: 'dcafc246-24b6-458b-a823-f6e7ecd6e9c3',
          amount: 700,
        },
      ],
    });
    
    expect(winResult).toHaveProperty('game_id', gameId);
    expect(winResult.transactions).toHaveLength(1);
    expect(winResult.transactions[0].action_id).toBe('dcafc246-24b6-458b-a823-f6e7ecd6e9c3');
    
    // Balance should have increased by win amount
    expect(winResult.balance).toBe(balanceAfterBet + 700);
  });

  test.skip('Multiple sequential bets', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    const gameId = generateActionId('sequential-bets');
    let currentBalance = 10000;

    // Place 3 sequential bets
    const betAmounts = [50, 75, 100];
    
    for (let i = 0; i < betAmounts.length; i++) {
      const betResult = await processActions({
        user_id: userId,
        currency: 'USD',
        game: 'acceptance:test',
        game_id: `${gameId}-${i}`,
        actions: [
          {
            action: 'bet',
            action_id: generateActionId(`sequential-bet-${i}`),
            amount: betAmounts[i],
          },
        ],
      });
      
      // Verify balance decreased correctly
      expect(betResult.balance).toBe(currentBalance - betAmounts[i]);
      currentBalance = betResult.balance;
    }
  });

  test('Win-only transaction', async ({ processActions }) => {
    const userId = newUserId();
    
    const result = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: generateActionId('new-user-game'),
      actions: [
        {
          action: 'win',
          action_id: generateActionId('new-user-win'),
          amount: 5000,
        },
      ],
    });
    
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].tx_id).toBeTruthy();
    expect(result.balance).toBe(5000);
  });
});

