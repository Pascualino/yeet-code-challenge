/**
 * Performance test configuration presets
 * Separate configs for Process endpoint (higher traffic) and RTP endpoint (lower traffic)
 * Select via LOAD_PROFILE environment variable: 'easy', 'mid', or 'hard'
 */

// Process endpoint configurations (write-heavy, higher traffic expected)
export const processConfigs = {
  easy: {
    stages: [
      { duration: '10s', target: 10 },
      { duration: '10s', target: 50 },
      { duration: '10s', target: 0 },
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
    stages: [
      { duration: '30s', target: 100 },
      { duration: '30s', target: 500 },
      { duration: '30s', target: 0 },
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
    stages: [
      { duration: '30s', target: 1000 },
      { duration: '30s', target: 5000 },
      { duration: '30s', target: 0 },
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

// RTP endpoint configurations (read-only aggregation, much lower traffic)
export const rtpConfigs = {
  easy: {
    stages: [
      { duration: '10s', target: 2 },
      { duration: '10s', target: 5 },
      { duration: '10s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: ['rate<0.01'],
      errors: ['rate<0.01'],
      'http_req_failed{status:500}': ['rate<0.01'],
      'http_req_failed{status:503}': ['rate<0.01'],
      'http_req_failed{status:429}': ['rate<0.01'],
    },
  },

  mid: {
    stages: [
      { duration: '20s', target: 5 },
      { duration: '20s', target: 10 },
      { duration: '20s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: ['rate<0.01'],
      errors: ['rate<0.01'],
      'http_req_failed{status:500}': ['rate<0.01'],
      'http_req_failed{status:503}': ['rate<0.01'],
      'http_req_failed{status:429}': ['rate<0.01'],
    },
  },

  hard: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '30s', target: 25 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
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
export function getProcessConfig() {
  const profile = __ENV.LOAD_PROFILE;
  
  if (!processConfigs[profile]) {
    throw new Error(
      `Invalid LOAD_PROFILE "${profile}".`
    );
  }
  
  console.log(`📊 Using load profile: ${profile} (Process endpoint)`);
  return processConfigs[profile];
}

/**
 * Get the active configuration for RTP endpoint based on LOAD_PROFILE environment variable
 */
export function getRtpConfig() {
  const profile = __ENV.LOAD_PROFILE;
  
  if (!rtpConfigs[profile]) {
    throw new Error(
      `Invalid LOAD_PROFILE "${profile}".`
    );
  }
  
  console.log(`📊 Using load profile: ${profile} (RTP endpoint)`);
  return rtpConfigs[profile];
}
