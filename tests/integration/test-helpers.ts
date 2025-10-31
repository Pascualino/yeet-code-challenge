import * as crypto from 'crypto';

export const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  ENDPOINT: '/aggregator/takehome/process',
  HMAC_SECRET: 'test',
  TEST_USER: {
    USER_ID: '8|USDT|USD',
    CURRENCY: 'USD',
    INITIAL_BALANCE: 74322001,
  },
} as const;

function generateHMAC(body: string, secret: string = TEST_CONFIG.HMAC_SECRET): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
}

function createAuthHeader(body: string): string {
  const signature = generateHMAC(body);
  return `HMAC-SHA256 ${signature}`;
}

export function generateActionId(prefix: string = 'action'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function createHeaders(body: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: createAuthHeader(body),
  };
}

export function newUserId() {
  return `${Math.floor(Math.random() * 1_000_000_000)}|USDT|USD`;
}