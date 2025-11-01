# Performance Tests with K6

This directory contains performance/load tests using [K6](https://k6.io/).

## Prerequisites

Install K6:

```bash
# macOS
brew install k6

# Or using Docker
docker pull grafana/k6
```

## Running Tests

### Load Profiles

The performance tests support three load profiles configured via `LOAD_PROFILE` environment variable:

- **easy** (default): Low load - 10 → 50 concurrent users. Suitable for CI/CD environments.
- **mid**: Medium load - 100 → 500 concurrent users. Suitable for local testing and staging.
- **hard**: High load - 1000 → 5000 concurrent users. Stress testing and production-like scenarios.

### Local Development

```bash
# Run with easy profile (default)
npm run test:performance

# Or run directly with k6
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test tests/performance/process-endpoint.js

# Run with different load profiles
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test --env LOAD_PROFILE=easy tests/performance/process-endpoint.js
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test --env LOAD_PROFILE=mid tests/performance/process-endpoint.js
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test --env LOAD_PROFILE=hard tests/performance/process-endpoint.js

# Run RTP endpoint tests
npm run test:performance:rtp              # easy profile
npm run test:performance:rtp:mid         # mid profile
npm run test:performance:rtp:hard        # hard profile
```

### With Docker (recommended for CI)

```bash
# Run with Docker
docker run --rm -i --network host \
  -v $(pwd):/scripts \
  -e BASE_URL=http://localhost:3000 \
  -e HMAC_SECRET=test \
  grafana/k6 run /scripts/tests/performance/process-endpoint.js
```

## Test Scenarios

### Process Endpoint (`process-endpoint.js`)

Tests the `/aggregator/takehome/process` endpoint with:
- Balance lookups (no actions)
- Single bet actions
- Bet + Win in same request

### RTP Endpoint (`rtp-endpoint.js`)

Tests the casino-wide RTP report endpoint:
- Casino-wide RTP: `GET /aggregator/takehome/rtp`

Tested with time-bounded queries (24 hours ago to 24 hours from now).

**Load Profiles:**

The test configuration is extracted to `config.js` with separate presets for each endpoint type:

### Process Endpoint Load Profiles

1. **Easy** (default, used in CI/CD):
   - 10 → 50 concurrent users
   - ~2 minutes total duration
   
2. **Mid**:
   - 100 → 500 concurrent users
   - ~3.5 minutes total duration

3. **Hard**:
   - 1,000 → 5,000 concurrent users
   - ~3.5 minutes total duration

### RTP Endpoint Load Profiles

RTP endpoints have **much lower traffic** due to the resource-intensive nature of aggregation queries:

1. **Easy** (default, used in CI/CD):
   - 2 → 5 concurrent users
   - ~1.5 minutes total duration
   
2. **Mid**:
   - 5 → 10 concurrent users
   - ~2.5 minutes total duration

3. **Hard**:
   - 10 → 25 concurrent users
   - ~3.5 minutes total duration

**Note:** RTP endpoints also have higher latency thresholds (p95<1000ms, p99<2000ms) due to the aggregation workload.

**Thresholds:**
- 95% of requests complete in < 500ms
- 99% of requests complete in < 1000ms
- Error rate < 1%

## Metrics

K6 collects the following metrics:
- `http_req_duration`: Request duration (p50, p95, p99)
- `http_req_failed`: Failed request rate
- `http_reqs`: Total requests per second
- `errors`: Custom error rate metric

## CI/CD Integration

Performance tests are integrated into GitHub Actions. The workflow (`.github/workflows/performance-tests.yml`) runs:

- **Manually**: Via `workflow_dispatch` (Actions tab → Performance Tests → Run workflow)
- **On main branch**: Automatically on pushes to main branch

**Note:** CI/CD uses the `easy` load profile by default due to limited resources on GitHub Actions runners. For higher load testing, run locally with `npm run test:performance:mid` or `npm run test:performance:hard`.

Results are stored as artifacts and displayed in the workflow summary.

## Adjusting Load

Load profiles are defined in `config.js`. To add a new profile or modify existing ones:

1. Edit `tests/performance/config.js`
2. Add or modify a profile in the `configs` object
3. Use it via `LOAD_PROFILE` environment variable

Example:
```javascript
// In config.js
myProfile: {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
  ],
  thresholds: { /* ... */ },
}
```

