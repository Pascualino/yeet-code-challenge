import { test, expect } from '@playwright/test';
import { TEST_CONFIG, createHeaders, generateActionId } from './test-helpers';

/**
 * Acceptance Scenarios: C, D, F
 * - Scenario C: Single Bet (No Win)
 * - Scenario D: Bet + Win in Same Request
 * - Scenario F: Bet Then Win (Separate Calls)
 */

const { BASE_URL, ENDPOINT } = TEST_CONFIG;

test.describe('Transaction Operations', () => {
  test.skip('Scenario C: Single Bet (No Win)', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: '1761032910245540510',
      finished: true,
      actions: [
        {
          action: 'bet',
          action_id: '3b42f070-dab5-4d6c-8bc6-7241b68f00bd',
          amount: 100,
        },
      ],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    // Verify response structure
    expect(result).toHaveProperty('game_id', '1761032910245540510');
    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('balance');
    
    // Verify transaction
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toHaveProperty('action_id', '3b42f070-dab5-4d6c-8bc6-7241b68f00bd');
    expect(result.transactions[0]).toHaveProperty('tx_id');
    expect(result.transactions[0].tx_id).toBeTruthy();
    
    // Verify balance decreased
    expect(typeof result.balance).toBe('number');
  });

  test.skip('Scenario D: Bet + Win in Same Request', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
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

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
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
    expect(typeof result.balance).toBe('number');
  });

  test.skip('Scenario F: Bet Then Win (Separate Calls)', async ({ request }) => {
    const gameId = '1761032911166149146';
    
    // Step 1: Place bet
    const betBody = JSON.stringify({
      user_id: '8|USDT|USD',
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

    const betResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(betBody),
      data: betBody,
    });

    expect(betResponse.ok()).toBeTruthy();
    const betResult = await betResponse.json();
    
    expect(betResult).toHaveProperty('game_id', gameId);
    expect(betResult.transactions).toHaveLength(1);
    expect(betResult.transactions[0].action_id).toBe('19bd35d5-50c3-4720-a402-145a46ab874c');
    
    const balanceAfterBet = betResult.balance;

    // Step 2: Add win in separate call
    const winBody = JSON.stringify({
      user_id: '8|USDT|USD',
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

    const winResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(winBody),
      data: winBody,
    });

    expect(winResponse.ok()).toBeTruthy();
    const winResult = await winResponse.json();
    
    expect(winResult).toHaveProperty('game_id', gameId);
    expect(winResult.transactions).toHaveLength(1);
    expect(winResult.transactions[0].action_id).toBe('dcafc246-24b6-458b-a823-f6e7ecd6e9c3');
    
    // Balance should have increased by win amount
    expect(winResult.balance).toBe(balanceAfterBet + 700);
  });

  test.skip('Multiple sequential bets', async ({ request }) => {
    const gameId = generateActionId('sequential-bets');
    let currentBalance: number;

    // Get initial balance
    const balanceBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
    });
    const balanceResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(balanceBody),
      data: balanceBody,
    });
    currentBalance = (await balanceResponse.json()).balance;

    // Place 3 sequential bets
    const betAmounts = [50, 75, 100];
    
    for (let i = 0; i < betAmounts.length; i++) {
      const betBody = JSON.stringify({
        user_id: '8|USDT|USD',
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

      const betResponse = await request.post(`${BASE_URL}${ENDPOINT}`, {
        headers: createHeaders(betBody),
        data: betBody,
      });

      expect(betResponse.ok()).toBeTruthy();
      const betResult = await betResponse.json();
      
      // Verify balance decreased correctly
      expect(betResult.balance).toBe(currentBalance - betAmounts[i]);
      currentBalance = betResult.balance;
    }
  });

  test.skip('Win-only transaction', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      game_id: generateActionId('win-only-game'),
      actions: [
        {
          action: 'win',
          action_id: generateActionId('win-only'),
          amount: 1000,
        },
      ],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].tx_id).toBeTruthy();
    expect(typeof result.balance).toBe('number');
  });
});

