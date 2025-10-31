import { test as base, expect } from '@playwright/test';
import { TEST_CONFIG, createHeaders, generateActionId, newUserId } from './test-helpers';

const { BASE_URL, ENDPOINT } = TEST_CONFIG;

type TestFixtures = {
  newUserWithBalance: (initialBalance: number) => Promise<string>;
};

export const test = base.extend<TestFixtures>({
  newUserWithBalance: async ({ request }, use) => {
    use(async (initialBalance: number): Promise<string> => {
      const userId = newUserId();

      const body = JSON.stringify({
        user_id: userId,
        currency: 'USD',
        game: 'fixture:setup',
        game_id: generateActionId('fixture-setup'),
        actions: [
          {
            action: 'win',
            action_id: generateActionId('initial-balance'),
            amount: initialBalance,
          },
        ],
      });

      const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
        headers: createHeaders(body),
        data: body,
      });
      expect(response.ok()).toBeTruthy();

      return userId;
    });
  },
});

export { expect } from '@playwright/test';

