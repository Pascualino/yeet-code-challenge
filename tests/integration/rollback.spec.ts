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
    expect(betResult.balance).toBe(10000 - 100);

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
    expect(rollbackResult.balance).toBe(10000 - 100 + 100);
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
    
    expect(rollbackResult.transactions).toHaveLength(1);
    expect(rollbackResult.transactions[0].action_id).toBe(rollbackActionId);
    expect(rollbackResult.balance).toBe(10000);

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
    expect(betResult.balance).toBe(10000);
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

  test('In-batch rollback: Action then Rollback in same request', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    const betActionId = generateActionId('bet');
    const rollbackActionId = generateActionId('rollback');
    
    // Send bet and rollback in the same request (bet comes first)
    const result = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: 'in-batch-rollback-1',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: betActionId,
          amount: 100,
        },
        {
          action: 'rollback',
          action_id: rollbackActionId,
          original_action_id: betActionId,
        },
      ],
    });
    
    // Both actions should create transactions
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].action_id).toBe(betActionId);
    expect(result.transactions[1].action_id).toBe(rollbackActionId);
    
    // Balance should be unchanged (bet then immediately rolled back)
    expect(result.balance).toBe(10000);
  });

  test('In-batch pre-rollback: Rollback then Action in same request', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    const rollbackActionId = generateActionId('rollback');
    const betActionId = generateActionId('bet');
    
    // Send rollback and bet in the same request (rollback comes first)
    const result = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:test',
      game_id: 'in-batch-rollback-2',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: rollbackActionId,
          original_action_id: betActionId,
        },
        {
          action: 'bet',
          action_id: betActionId,
          amount: 100,
        },
      ],
    });
    
    // Both actions should create transactions
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].action_id).toBe(rollbackActionId);
    expect(result.transactions[1].action_id).toBe(betActionId);
    
    // Balance should be unchanged (bet was pre-rolled-back)
    expect(result.balance).toBe(10000);
  });

  test('Complex cross-batch rollbacks: 3 operations with inter-batch rollbacks', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    // Operation 1: Place bet and win
    const bet1ActionId = generateActionId('bet');
    const win1ActionId = generateActionId('win');
    const result1 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:complex',
      game_id: 'complex-1',
      finished: false,
      actions: [
        {
          action: 'bet',
          action_id: bet1ActionId,
          amount: 100,
        },
        {
          action: 'win',
          action_id: win1ActionId,
          amount: 150,
        },
      ],
    });
    
    expect(result1.transactions).toHaveLength(2);
    expect(result1.balance).toBe(10000 - 100 + 150); // 10050
    
    // Operation 2: Multiple actions including rollback for previous operation, and pre-rollback for next
    const bet2ActionId = generateActionId('bet');
    const win2ActionId = generateActionId('win');
    const bet3ActionId = generateActionId('bet');
    const rollback1ActionId = generateActionId('rollback'); // Rolls back bet1 from operation 1
    const rollback2ActionId = generateActionId('rollback'); // Pre-rollback for bet3 (will be in operation 3)
    
    const result2 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:complex',
      game_id: 'complex-2',
      finished: false,
      actions: [
        {
          action: 'bet',
          action_id: bet2ActionId,
          amount: 200,
        },
        {
          action: 'win',
          action_id: win2ActionId,
          amount: 300,
        },
        {
          action: 'rollback',
          action_id: rollback1ActionId,
          original_action_id: bet1ActionId, // Rollback bet from operation 1
        },
        {
          action: 'rollback',
          action_id: rollback2ActionId,
          original_action_id: bet3ActionId, // Pre-rollback for bet in operation 3
        },
      ],
    });
    
    expect(result2.transactions).toHaveLength(4);
    // Balance: 10050 - 200 + 300 + 100 (rollback of bet1) = 10250
    expect(result2.balance).toBe(10250);
    
    // Operation 3: Actions including bet that was pre-rolled-back, and rollback for win from operation 1
    const win3ActionId = generateActionId('win');
    const rollback3ActionId = generateActionId('rollback'); // Rolls back win1 from operation 1
    
    const result3 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:complex',
      game_id: 'complex-3',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: bet3ActionId, // This was pre-rolled-back in operation 2, should not affect balance
          amount: 50,
        },
        {
          action: 'win',
          action_id: win3ActionId,
          amount: 75,
        },
        {
          action: 'rollback',
          action_id: rollback3ActionId,
          original_action_id: win1ActionId, // Rollback win from operation 1
        },
      ],
    });
    
    expect(result3.transactions).toHaveLength(3);
    // Balance: 10250 + 75 (win3) - 150 (rollback of win1) = 10175
    // bet3 doesn't affect balance because it was pre-rolled-back
    expect(result3.balance).toBe(10175);
    
    // Verify all transactions were created with tx_ids
    expect(result3.transactions.every(t => t.tx_id)).toBeTruthy();
  });

  test('Multiple rollbacks: 4 actions then 3 rollbacks', async ({
    newUserWithBalance,
    processActions,
  }) => {
    const userId = await newUserWithBalance(10000);
    
    // Operation 1: Place 4 bets/wins
    const bet1ActionId = generateActionId('bet');
    const win1ActionId = generateActionId('win');
    const bet2ActionId = generateActionId('bet');
    const win2ActionId = generateActionId('win');
    
    const result1 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:multiple',
      game_id: 'multiple-1',
      finished: false,
      actions: [
        {
          action: 'bet',
          action_id: bet1ActionId,
          amount: 100,
        },
        {
          action: 'win',
          action_id: win1ActionId,
          amount: 150,
        },
        {
          action: 'bet',
          action_id: bet2ActionId,
          amount: 200,
        },
        {
          action: 'win',
          action_id: win2ActionId,
          amount: 250,
        },
      ],
    });
    
    expect(result1.transactions).toHaveLength(4);
    // Balance: 10000 - 100 + 150 - 200 + 250 = 10100
    expect(result1.balance).toBe(10100);
    
    // Operation 2: Rollback 3 of the 4 actions (bet1, win1, bet2)
    const rollback1ActionId = generateActionId('rollback'); // Rolls back bet1
    const rollback2ActionId = generateActionId('rollback'); // Rolls back win1
    const rollback3ActionId = generateActionId('rollback'); // Rolls back bet2
    
    const result2 = await processActions({
      user_id: userId,
      currency: 'USD',
      game: 'acceptance:multiple',
      game_id: 'multiple-2',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: rollback1ActionId,
          original_action_id: bet1ActionId,
        },
        {
          action: 'rollback',
          action_id: rollback2ActionId,
          original_action_id: win1ActionId,
        },
        {
          action: 'rollback',
          action_id: rollback3ActionId,
          original_action_id: bet2ActionId,
        },
      ],
    });
    
    expect(result2.transactions).toHaveLength(3);
    // Balance calculation:
    // Operation 1: bet1(-100), win1(+150), bet2(-200), win2(+250) = net +100, balance 10100
    // Operation 2: rollback bet1(+100), rollback win1(-150), rollback bet2(+200) = net +150
    // Final: 10100 + 150 = 10250
    // win2 remains because it wasn't rolled back
    expect(result2.balance).toBe(10250);
    
    // Verify all transactions were created
    expect(result2.transactions.every(t => t.tx_id)).toBeTruthy();
    expect(result2.transactions[0].action_id).toBe(rollback1ActionId);
    expect(result2.transactions[1].action_id).toBe(rollback2ActionId);
    expect(result2.transactions[2].action_id).toBe(rollback3ActionId);
  });
});

