/**
 * Performance test configuration presets
 * Select via LOAD_PROFILE environment variable: 'easy', 'mid', or 'hard'
 */

export const configs = {
  easy: {
    // Low load - suitable for CI/CD environments with limited resources
    stages: [
      { duration: '10s', target: 10 },   // Ramp up to 10 users
      { duration: '10s', target: 10 },   // Stay at 10 users
      { duration: '10s', target: 50 },   // Ramp up to 50 users
      { duration: '10s', target: 50 },   // Stay at 50 users
      { duration: '10s', target: 0 },    // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: ['rate<0.01'],
      errors: ['rate<0.01'],
      'http_req_failed{status:500}': ['rate<0.01'],
      'http_req_failed{status:503}': ['rate<0.01'],
      'http_req_failed{status:429}': ['rate<0.01'],
    },
  },

  mid: {
    // Medium load - suitable for local testing and staging
    stages: [
      { duration: '30s', target: 100 },  // Ramp up to 100 users
      { duration: '1m', target: 100 },   // Stay at 100 users
      { duration: '30s', target: 500 }, // Ramp up to 500 users
      { duration: '1m', target: 500 },  // Stay at 500 users
      { duration: '30s', target: 0 },   // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: ['rate<0.01'],
      errors: ['rate<0.01'],
      'http_req_failed{status:500}': ['rate<0.01'],
      'http_req_failed{status:503}': ['rate<0.01'],
      'http_req_failed{status:429}': ['rate<0.01'],
    },
  },

  hard: {
    // High load - stress testing and production-like scenarios
    stages: [
      { duration: '30s', target: 1000 }, // Ramp up to 1000 users
      { duration: '1m', target: 1000 },  // Stay at 1000 users
      { duration: '30s', target: 5000 }, // Ramp up to 5000 users
      { duration: '1m', target: 5000 },  // Stay at 5000 users
      { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: ['rate<0.01'],
      errors: ['rate<0.01'],
      'http_req_failed{status:500}': ['rate<0.01'],
      'http_req_failed{status:503}': ['rate<0.01'],
      'http_req_failed{status:429}': ['rate<0.01'],
    },
  },
};

/**
 * Get the active configuration based on LOAD_PROFILE environment variable
 */
export function getConfig() {
  const profile = __ENV.LOAD_PROFILE;
  
  if (!configs[profile]) {
    throw new Error(`Invalid LOAD_PROFILE "${profile}"`);
  }
  
  console.log(`📊 Using load profile: ${profile}`);
  return configs[profile];
}

