import { test, expect } from './fixtures';
import { generateActionId } from './test-helpers';

/**
 * Acceptance Scenario H: Duplicate Action ID (Idempotency)
 * 
 * Tests that the same action_id submitted multiple times:
 * - Returns the original tx_id
 * - Does not apply balance changes multiple times
 * - Still appears in the transactions array
 */

test.describe('Idempotency', () => {
  test.skip('Scenario H: Duplicate Action ID - same request resubmission', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    const requestParams = {
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032913606999220',
      actions: [
        {
          action: 'bet' as const,
          action_id: 'f61c5eba-fb26-4070-89b5-c3a2edf54c02',
          amount: 100,
        },
      ],
    };

    // First submission
    const result1 = await processActions(requestParams);
    
    expect(result1).toHaveProperty('balance');
    expect(result1.transactions).toHaveLength(1);
    expect(result1.transactions[0].action_id).toBe('f61c5eba-fb26-4070-89b5-c3a2edf54c02');
    
    const originalTxId = result1.transactions[0].tx_id;
    const balanceAfterFirst = result1.balance;

    // Second submission (duplicate)
    const result2 = await processActions(requestParams);
    
    // Should return same tx_id
    expect(result2.transactions).toHaveLength(1);
    expect(result2.transactions[0].tx_id).toBe(originalTxId);
    
    // Balance should not change
    expect(result2.balance).toBe(balanceAfterFirst);
  });

  test.skip('Scenario H: Duplicate + New Action ID in same request', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    // First request: single bet
    const firstResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032913606999220-mixed',
      actions: [
        {
          action: 'bet',
          action_id: 'duplicate-test-action-id',
          amount: 100,
        },
      ],
    });
    
    const originalTxId = firstResult.transactions[0].tx_id;
    const balanceAfterFirst = firstResult.balance;

    // Second request: duplicate action + new action
    const secondResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032913606999220-mixed',
      actions: [
        {
          action: 'bet',
          action_id: 'duplicate-test-action-id', // Duplicate
          amount: 100,
        },
        {
          action: 'bet',
          action_id: 'd94b2fa5-e87f-4d8e-9a01-4a443ed5c11c', // New
          amount: 50,
        },
      ],
    });
    
    // Should have 2 transactions
    expect(secondResult.transactions).toHaveLength(2);
    
    // First transaction: duplicate, should have original tx_id
    expect(secondResult.transactions[0].action_id).toBe('duplicate-test-action-id');
    expect(secondResult.transactions[0].tx_id).toBe(originalTxId);
    
    // Second transaction: new, should have new tx_id
    expect(secondResult.transactions[1].action_id).toBe('d94b2fa5-e87f-4d8e-9a01-4a443ed5c11c');
    expect(secondResult.transactions[1].tx_id).toBeTruthy();
    expect(secondResult.transactions[1].tx_id).not.toBe(originalTxId);
    
    // Balance should only decrease by 50 (new action only)
    expect(secondResult.balance).toBe(balanceAfterFirst - 50);
  });

  test.skip('Idempotency with wins', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    const actionId = generateActionId('idempotent-win-test');
    
    const requestParams = {
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: 'idempotency-win-test',
      actions: [
        {
          action: 'win' as const,
          action_id: actionId,
          amount: 500,
        },
      ],
    };

    // First submission
    const result1 = await processActions(requestParams);
    const originalTxId = result1.transactions[0].tx_id;
    const balanceAfter = result1.balance;

    // Second submission (duplicate)
    const result2 = await processActions(requestParams);
    
    // Should return same tx_id and balance
    expect(result2.transactions[0].tx_id).toBe(originalTxId);
    expect(result2.balance).toBe(balanceAfter);
  });
});

