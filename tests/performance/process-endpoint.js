import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, ENDPOINT, createHeaders, randomUserId, randomActionId } from './utils.js';

// Custom metrics
const errorRate = new Rate('errors');
const errorStatusTrend = new Trend('error_status');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '20s', target: 500 },
    { duration: '10s', target: 100 },
    { duration: '5s', target: 0 },
  ],
  thresholds: { 
    http_req_duration: ['p(95)<100', 'p(99)<200'],
    http_req_failed: ['rate<0.005'],
    errors: ['rate<0.005'],
    'http_req_failed{status:500}': ['rate<0.01'],  // Track 500 errors separately
    'http_req_failed{status:503}': ['rate<0.01'],  // Track 503 errors separately
    'http_req_failed{status:429}': ['rate<0.01'],  // Track rate limit errors
  },
};

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
    errorStatusTrend.add(balanceResponse.status);
    if (balanceResponse.status !== 200) {
      console.error(`Balance lookup failed: ${balanceResponse.status} - ${balanceResponse.body.substring(0, 200)}`);
    }
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

  const setupCheck = check(setupResponse, {
    'setup win status is 200': (r) => r.status === 200,
  });

  if (!setupCheck && setupResponse.status !== 200) {
    errorRate.add(1);
    errorStatusTrend.add(setupResponse.status);
    console.error(`Setup win failed: ${setupResponse.status} - ${setupResponse.body.substring(0, 200)}`);
  }

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
    errorStatusTrend.add(betResponse.status);
    if (betResponse.status !== 200) {
      console.error(`Bet request failed: ${betResponse.status} - ${betResponse.body.substring(0, 200)}`);
    }
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
    errorStatusTrend.add(betWinResponse.status);
    if (betWinResponse.status !== 200) {
      console.error(`Bet+Win request failed: ${betWinResponse.status} - ${betWinResponse.body.substring(0, 200)}`);
    }
  }

  sleep(0.5);
}

