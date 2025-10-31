import { test, expect } from './fixtures';
import { generateActionId } from './test-helpers';

/**
 * Acceptance Scenario B: Balance Lookup
 * 
 * Tests balance-only requests (no actions array)
 */

test.describe('Balance Operations', () => {
  test('Scenario B: Balance Lookup - no actions', async ({ processActions }) => {
    const result = await processActions({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
    });
    
    // Balance-only response format
    expect(result).toHaveProperty('balance');
    expect(typeof result.balance).toBe('number');
    expect(result.balance).toBe(74322001);
  });

  test('Balance lookup with empty actions array', async ({ processActions }) => {
    const result = await processActions({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      actions: [],
    });
    
    expect(result).toHaveProperty('balance');
    expect(result.balance).toBe(74322001);
  });

  test('Balance consistency after operations', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10_000);
    
    const result1 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
    });
    const balance1 = result1.balance;
    expect(balance1).toBe(10_000);

    // Perform a bet operation
    const betAmount = 100;
    await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: generateActionId('balance-consistency-test'),
      actions: [
        {
          action: 'bet',
          action_id: generateActionId('balance-test'),
          amount: betAmount,
        },
      ],
    });

    // Check balance again
    const result2 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
    });

    expect(result2.balance).toBe(10_000 - betAmount);
  });
});

