import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import crypto from 'k6/crypto';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ENDPOINT = '/aggregator/takehome/process';
const HMAC_SECRET = __ENV.HMAC_SECRET || 'test';

/**
 * Generate HMAC-SHA256 signature for request body
 */
function generateHMAC(body) {
  return crypto.hmac('sha256', HMAC_SECRET, body, 'hex');
}

/**
 * Create headers with HMAC authentication
 */
function createHeaders(body) {
  const hmac = generateHMAC(body);
  return {
    'Content-Type': 'application/json',
    Authorization: `HMAC-SHA256 ${hmac}`,
  };
}

/**
 * Generate a random user ID for testing
 */
function randomUserId() {
  return `${Math.floor(Math.random() * 1000000)}|USDT|USD`;
}

/**
 * Generate a random action ID
 */
function randomActionId() {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export default function () {
  const userId = randomUserId();
  
  // Test scenario 1: Balance lookup (no actions)
  const balanceLookupBody = JSON.stringify({
    user_id: userId,
    currency: 'USD',
    game: 'perf:test',
  });

  const balanceResponse = http.post(
    `${BASE_URL}${ENDPOINT}`,
    balanceLookupBody,
    { headers: createHeaders(balanceLookupBody) }
  );

  const balanceCheck = check(balanceResponse, {
    'balance lookup status is 200': (r) => r.status === 200,
    'balance lookup has balance field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.balance === 'number';
      } catch {
        return false;
      }
    },
  });

  if (!balanceCheck) {
    errorRate.add(1);
  }

  sleep(0.1);

  // Setup: Give user initial balance with a win
  const setupWinBody = JSON.stringify({
    user_id: userId,
    currency: 'USD',
    game: 'perf:test',
    game_id: randomActionId(),
    actions: [
      {
        action: 'win',
        action_id: randomActionId(),
        amount: 1000,
      },
    ],
  });

  const setupResponse = http.post(
    `${BASE_URL}${ENDPOINT}`,
    setupWinBody,
    { headers: createHeaders(setupWinBody) }
  );

  check(setupResponse, {
    'setup win status is 200': (r) => r.status === 200,
  });

  sleep(0.1);

  // Test scenario 2: Single bet action
  const betBody = JSON.stringify({
    user_id: userId,
    currency: 'USD',
    game: 'perf:test',
    game_id: randomActionId(),
    actions: [
      {
        action: 'bet',
        action_id: randomActionId(),
        amount: 100,
      },
    ],
  });

  const betResponse = http.post(
    `${BASE_URL}${ENDPOINT}`,
    betBody,
    { headers: createHeaders(betBody) }
  );

  const betCheck = check(betResponse, {
    'bet request status is 200': (r) => r.status === 200,
    'bet request has transactions': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.transactions) && body.transactions.length === 1;
      } catch {
        return false;
      }
    },
    'bet request has balance': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.balance === 'number';
      } catch {
        return false;
      }
    },
  });

  if (!betCheck) {
    errorRate.add(1);
  }

  sleep(0.1);

  // Test scenario 3: Bet + Win in same request
  const betWinBody = JSON.stringify({
    user_id: userId,
    currency: 'USD',
    game: 'perf:test',
    game_id: randomActionId(),
    actions: [
      {
        action: 'bet',
        action_id: randomActionId(),
        amount: 50,
      },
      {
        action: 'win',
        action_id: randomActionId(),
        amount: 100,
      },
    ],
  });

  const betWinResponse = http.post(
    `${BASE_URL}${ENDPOINT}`,
    betWinBody,
    { headers: createHeaders(betWinBody) }
  );

  const betWinCheck = check(betWinResponse, {
    'bet+win request status is 200': (r) => r.status === 200,
    'bet+win has 2 transactions': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.transactions) && body.transactions.length === 2;
      } catch {
        return false;
      }
    },
  });

  if (!betWinCheck) {
    errorRate.add(1);
  }

  sleep(0.5);
}

