import * as crypto from 'crypto';

/**
 * Test configuration constants
 */
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

/**
 * Generate HMAC-SHA256 signature for request body
 * @param body - Raw request body string (JSON stringified)
 * @param secret - HMAC secret key (defaults to test secret)
 * @returns Hex-encoded HMAC signature
 */
export function generateHMAC(body: string, secret: string = TEST_CONFIG.HMAC_SECRET): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
}

/**
 * Create Authorization header with HMAC signature
 * @param body - Raw request body string
 * @returns Authorization header value
 */
export function createAuthHeader(body: string): string {
  const signature = generateHMAC(body);
  return `HMAC-SHA256 ${signature}`;
}

/**
 * Generate a unique action ID with optional prefix
 * @param prefix - Optional prefix for the action ID
 * @returns Unique action ID string
 */
export function generateActionId(prefix: string = 'action'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create request headers for API calls
 * @param body - Raw request body string
 * @returns Headers object with Content-Type and Authorization
 */
export function createHeaders(body: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: createAuthHeader(body),
  };
}

export function newUserId() {
  return `${Math.floor(Math.random() * 1_000_000_000)}|USDT|USD`;
}