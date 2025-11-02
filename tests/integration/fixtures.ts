import { test as base, expect } from '@playwright/test';
import { TEST_CONFIG, createHeaders, generateActionId, newUserId } from './test-helpers';
import { ProcessRequestDto } from 'src/aggregator/dto/process-request.dto';
import { ActionResultsResponseDto } from 'src/aggregator/dto/process-response.dto';

const { BASE_URL, ENDPOINT } = TEST_CONFIG;

type TestFixtures = {
  newUserWithBalance: (initialBalance: number) => Promise<string>;
  processActions: (params: ProcessRequestDto) => Promise<ActionResultsResponseDto>;
};

export const test = base.extend<TestFixtures>({
  newUserWithBalance: async ({ request }, use) => {
    use(async (initialBalance: number): Promise<string> => {
      const userId = newUserId();

      const body = JSON.stringify({
        user_id: userId,
        currency: 'USD',
        game: 'fixture:setup',
        game_id: 'initial-balance',
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

  processActions: async ({ request }, use) => {
    use(async (params: ProcessRequestDto) => {
      const body = JSON.stringify({
        user_id: params.user_id,
        currency: params.currency || 'USD',
        game: params.game || 'acceptance:test',
        ...(params.game_id && { game_id: params.game_id }),
        ...(params.finished !== undefined && { finished: params.finished }),
        ...(params.actions && { actions: params.actions }),
      });

      const response = await request.post(`${BASE_URL}${ENDPOINT}`, {
        headers: createHeaders(body),
        data: body,
      });

      expect(response.ok()).toBeTruthy();
      return await response.json();
    });
  },
});

export { expect } from '@playwright/test';

