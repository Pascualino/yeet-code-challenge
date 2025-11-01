import crypto from 'k6/crypto';

export const BASE_URL = __ENV.BASE_URL;
export const ENDPOINT = '/aggregator/takehome/process';
export const HMAC_SECRET = __ENV.HMAC_SECRET;

/* 
  This mirrors the logic in tests/integration/test-helpers.ts
  but written in JavaScript directly. I'd probably do something better
  on a long-term production environment but for now it's fine.
*/

export function generateHMAC(body, secret = HMAC_SECRET) {
  return crypto.hmac('sha256', secret, body, 'hex');
}

export function createHeaders(body) {
  const hmac = generateHMAC(body);
  return {
    'Content-Type': 'application/json',
    Authorization: `HMAC-SHA256 ${hmac}`,
  };
}

export function randomUserId() {
  return `${Math.floor(Math.random() * 1000000)}|USDT|USD`;
}

export function randomActionId() {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

