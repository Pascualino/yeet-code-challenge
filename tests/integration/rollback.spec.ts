import { test, expect } from '@playwright/test';
import { TEST_CONFIG, createHeaders } from './test-helpers';

/**
 * Acceptance Scenarios: G, I, J
 * - Scenario G: Bet Then Rollback
 * - Scenario I: Pre-Rollback (Rollback Before Original)
 * - Scenario J: Multiple Pre-Rollbacks
 */

const { BASE_URL, ENDPOINT } = TEST_CONFIG;

test.describe('Rollback Operations', () => {
  test.skip('Scenario G: Bet Then Rollback', async ({ request }) => {
    // Step 1: Place a bet
    const betBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761034000123456789',
      actions: [
        {
          action: 'bet',
          action_id: '4dbcbf1d-bcf6-43e9-9a62-7d3c0f3c6486',
          amount: 100,
        },
      ],
    });

    const betResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(betBody),
      data: betBody,
    });

    expect(betResponse.ok()).toBeTruthy();
    const betResult = await betResponse.json();
    expect(betResult).toHaveProperty('game_id', '1761034000123456789');
    expect(betResult.transactions).toHaveLength(1);
    expect(betResult.transactions[0].action_id).toBe(
      '4dbcbf1d-bcf6-43e9-9a62-7d3c0f3c6486'
    );
    const balanceAfterBet = betResult.balance;

    // Step 2: Rollback the bet
    const rollbackBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761034000123456789',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: 'c9a9c3a7-e9e8-4f5a-9fdf-1d8a377d1b8f',
          original_action_id: '4dbcbf1d-bcf6-43e9-9a62-7d3c0f3c6486',
        },
      ],
    });

    const rollbackResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(rollbackBody),
      data: rollbackBody,
    });

    expect(rollbackResponse.ok()).toBeTruthy();
    const rollbackResult = await rollbackResponse.json();
    
    // Verify rollback transaction
    expect(rollbackResult).toHaveProperty('game_id', '1761034000123456789');
    expect(rollbackResult.transactions).toHaveLength(1);
    expect(rollbackResult.transactions[0].action_id).toBe(
      'c9a9c3a7-e9e8-4f5a-9fdf-1d8a377d1b8f'
    );
    expect(rollbackResult.transactions[0].tx_id).toBeTruthy();
    
    // Balance should be restored (increased by 100)
    expect(rollbackResult.balance).toBe(balanceAfterBet + 100);
  });

  test.skip('Scenario I: Pre-Rollback (Rollback Before Original)', async ({
    request,
  }) => {
    // Step 1: Send rollback BEFORE the original action exists
    const rollbackBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032915476894301',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: '65d57850-5ee3-418b-b1b0-b4975242efcf',
          original_action_id: '27710aca-60f9-4259-a9bb-26f75cd05917',
        },
      ],
    });

    const rollbackResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(rollbackBody),
      data: rollbackBody,
    });

    expect(rollbackResponse.ok()).toBeTruthy();
    const rollbackResult = await rollbackResponse.json();
    const balanceAfterPreRollback = rollbackResult.balance;
    
    expect(rollbackResult.transactions).toHaveLength(1);
    expect(rollbackResult.transactions[0].action_id).toBe(
      '65d57850-5ee3-418b-b1b0-b4975242efcf'
    );

    // Step 2: Send the original bet (which was pre-rolled-back)
    const betBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032915476894301',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: '27710aca-60f9-4259-a9bb-26f75cd05917',
          amount: 100,
        },
      ],
    });

    const betResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(betBody),
      data: betBody,
    });

    expect(betResponse.ok()).toBeTruthy();
    const betResult = await betResponse.json();
    
    // Verify bet creates tx_id but DOES NOT change balance
    expect(betResult.transactions).toHaveLength(1);
    expect(betResult.transactions[0].action_id).toBe(
      '27710aca-60f9-4259-a9bb-26f75cd05917'
    );
    expect(betResult.transactions[0].tx_id).toBeTruthy();
    
    // Balance should remain unchanged (pre-rolled-back)
    expect(betResult.balance).toBe(balanceAfterPreRollback);
  });

  test.skip('Scenario J: Multiple Pre-Rollbacks', async ({ request }) => {
    // Step 1: Send two rollbacks BEFORE their original actions exist
    const rollbacksBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032916227566632',
      finished: true,
      actions: [
        {
          action: 'rollback',
          action_id: '12af93e7-f208-46f1-9399-4c1668fdd675',
          original_action_id: 'a2fd2ce9-5184-48b6-bdde-f6ba05d32e01',
        },
        {
          action: 'rollback',
          action_id: '85762689-2ab3-40d6-a7cd-e3babb53ae06',
          original_action_id: '7e4ad25b-b2c2-4eb7-b38e-63e7ddcdab52',
        },
      ],
    });

    const rollbacksResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(rollbacksBody),
      data: rollbacksBody,
    });

    expect(rollbacksResponse.ok()).toBeTruthy();
    const rollbacksResult = await rollbacksResponse.json();
    const balanceAfterRollbacks = rollbacksResult.balance;
    
    expect(rollbacksResult.transactions).toHaveLength(2);

    // Step 2: Send the original bet + win (both pre-rolled-back)
    const actionsBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032916227566632',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: 'a2fd2ce9-5184-48b6-bdde-f6ba05d32e01',
          amount: 100,
        },
        {
          action: 'win',
          action_id: '7e4ad25b-b2c2-4eb7-b38e-63e7ddcdab52',
          amount: 200,
        },
      ],
    });

    const actionsResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(actionsBody),
      data: actionsBody,
    });

    expect(actionsResponse.ok()).toBeTruthy();
    const actionsResult = await actionsResponse.json();
    
    // Verify both actions create tx_ids
    expect(actionsResult.transactions).toHaveLength(2);
    expect(actionsResult.transactions[0].action_id).toBe(
      'a2fd2ce9-5184-48b6-bdde-f6ba05d32e01'
    );
    expect(actionsResult.transactions[1].action_id).toBe(
      '7e4ad25b-b2c2-4eb7-b38e-63e7ddcdab52'
    );
    
    // Balance should remain unchanged (both were pre-rolled-back)
    expect(actionsResult.balance).toBe(balanceAfterRollbacks);
  });
});

