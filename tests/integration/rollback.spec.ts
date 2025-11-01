import { test, expect } from './fixtures';
import { generateActionId } from './test-helpers';

/**
 * Acceptance Scenarios: G, I, J
 * - Scenario G: Bet Then Rollback
 * - Scenario I: Pre-Rollback (Rollback Before Original)
 * - Scenario J: Multiple Pre-Rollbacks
 */

test.describe('Rollback Operations', () => {
  test('Scenario G: Bet Then Rollback', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    
    // Step 1: Place a bet
    const betActionId = generateActionId('bet');
    const betResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761034000123456789',
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
    const balanceAfterBet = betResult.balance;

    // Step 2: Rollback the bet
    const rollbackActionId = generateActionId('rollback');
    const rollbackResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761034000123456789',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: rollbackActionId,
          original_action_id: betActionId,
        },
      ],
    });
    
    // Verify rollback transaction
    expect(rollbackResult.transactions).toHaveLength(1);
    expect(rollbackResult.transactions[0].action_id).toBe(rollbackActionId);
    expect(rollbackResult.transactions[0].tx_id).toBeTruthy();
    
    // Balance should be restored (increased by 100)
    expect(rollbackResult.balance).toBe(balanceAfterBet + 100);
  });

  test('Scenario I: Pre-Rollback (Rollback Before Original)', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    // Step 1: Send rollback BEFORE the original action exists
    const rollbackActionId = generateActionId('rollback');
    const originalActionId = generateActionId('bet');
    const rollbackResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032915476894301',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: rollbackActionId,
          original_action_id: originalActionId,
        },
      ],
    });
    
    const balanceAfterPreRollback = rollbackResult.balance;
    expect(rollbackResult.transactions).toHaveLength(1);
    expect(rollbackResult.transactions[0].action_id).toBe(rollbackActionId);

    // Step 2: Send the original bet (which was pre-rolled-back)
    const betResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032915476894301',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: originalActionId,
          amount: 100,
        },
      ],
    });
    
    // Verify bet creates tx_id but DOES NOT change balance
    expect(betResult.transactions).toHaveLength(1);
    expect(betResult.transactions[0].action_id).toBe(originalActionId);
    expect(betResult.transactions[0].tx_id).toBeTruthy();
    
    // Balance should remain unchanged (pre-rolled-back)
    expect(betResult.balance).toBe(balanceAfterPreRollback);
  });

  test('Scenario J: Multiple Pre-Rollbacks', async ({ newUserWithBalance, processActions }) => {
    const userId = await newUserWithBalance(10000);
    
    // Step 1: Send two rollbacks BEFORE their original actions exist
    const rollbackActionId1 = generateActionId('rollback');
    const rollbackActionId2 = generateActionId('rollback');
    const originalActionId1 = generateActionId('bet');
    const originalActionId2 = generateActionId('win');
    const rollbacksResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032916227566632',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: rollbackActionId1,
          original_action_id: originalActionId1,
        },
        {
          action: 'rollback',
          action_id: rollbackActionId2,
          original_action_id: originalActionId2,
        },
      ],
    });
    
    const balanceAfterRollbacks = rollbacksResult.balance;
    expect(rollbacksResult.transactions).toHaveLength(2);

    // Step 2: Send the original bet + win (both pre-rolled-back)
    const actionsResult = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032916227566632',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: originalActionId1,
          amount: 100,
        },
        {
          action: 'win',
          action_id: originalActionId2,
          amount: 200,
        },
      ],
    });
    
    // Verify both actions create tx_ids
    expect(actionsResult.transactions).toHaveLength(2);
    expect(actionsResult.transactions[0].action_id).toBe(originalActionId1);
    expect(actionsResult.transactions[1].action_id).toBe(originalActionId2);
    
    // Balance should remain unchanged (both were pre-rolled-back)
    expect(actionsResult.balance).toBe(balanceAfterRollbacks);
  });
});

