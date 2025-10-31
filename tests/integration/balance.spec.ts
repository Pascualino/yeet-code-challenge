import { test, expect } from '@playwright/test';
import { TEST_CONFIG, createHeaders, generateActionId } from './test-helpers';

/**
 * Acceptance Scenario B: Balance Lookup
 * 
 * Tests balance-only requests (no actions array)
 */

const { BASE_URL, ENDPOINT } = TEST_CONFIG;

test.describe('Balance Operations', () => {
  test('Scenario B: Balance Lookup - no actions', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    // Balance-only response format
    expect(result).toHaveProperty('balance');
    expect(typeof result.balance).toBe('number');
    expect(result.balance).toBe(74322001);
  });

  test.skip('Balance lookup with empty actions array', async ({ request }) => {
    const body = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
      actions: [],
    });

    const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(body),
      data: body,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result).toHaveProperty('balance');
    expect(typeof result.balance).toBe('number');
  });

  test.skip('Balance consistency after operations', async ({ request }) => {
    // Get initial balance
    const balanceBody = JSON.stringify({
      user_id: '8|USDT|USD',
      currency: 'USD',
      game: 'acceptance:test',
    });

    const balanceResponse1 = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(balanceBody),
      data: balanceBody,
    });

    const balance1 = (await balanceResponse1.json()).balance;

    // Perform a bet operation
    const betAmount = 100;
    const betBody = JSON.stringify({
      user_id: '8|USDT|USD',
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

    await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(betBody),
      data: betBody,
    });

    // Check balance again
    const balanceResponse2 = await request.post(`${BASE_URL}${ENDPOINT}`, {
      headers: createHeaders(balanceBody),
      data: balanceBody,
    });

    const balance2 = (await balanceResponse2.json()).balance;

    // Balance should have decreased by bet amount
    expect(balance2).toBe(balance1 - betAmount);
  });
});

