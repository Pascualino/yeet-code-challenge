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
    
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].action_id).toBe(action_id);
    expect(result.transactions[0].tx_id).toBeTruthy();
    
    expect(result.balance).toBe(5000 - 100);
  });

  test('Scenario D: Bet + Win in Same Request', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    
    const betActionId = generateActionId('bet');
    const winActionId = generateActionId('win');
    const result = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032910488163506',
      actions: [
        {
          action: 'bet',
          action_id: betActionId,
          amount: 100,
        },
        {
          action: 'win',
          action_id: winActionId,
          amount: 250,
        },
      ],
    });
    
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].action_id).toBe(betActionId);
    expect(result.transactions[0].tx_id).toBeTruthy();
    
    expect(result.transactions[1].action_id).toBe(winActionId);
    expect(result.transactions[1].tx_id).toBeTruthy();
    
    expect(result.balance).toBe(10000 - 100 + 250);
  });

  test('Scenario F: Bet Then Win (Separate Calls)', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);

    const gameId = '1761032911166149146';
    const betActionId = generateActionId('bet');
    const betResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: gameId,
      actions: [
        {
          action: 'bet',
          action_id: betActionId,
          amount: 100,
        },
      ],
    });
    
    expect(betResult.transactions).toHaveLength(1);
    expect(betResult.transactions[0].action_id).toBe(betActionId);
    expect(betResult.balance).toBe(10000 - 100);

    const winActionId = generateActionId('win');
    const winResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: gameId,
      finished: true,
      actions: [
        {
          action: 'win',
          action_id: winActionId,
          amount: 700,
        },
      ],
    });
    
    expect(winResult.transactions).toHaveLength(1);
    expect(winResult.transactions[0].action_id).toBe(winActionId);
    
    expect(winResult.balance).toBe(10000 - 100 + 700);
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

