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

### Local Development

```bash
# Run process endpoint tests (uses defaults: localhost:3000, HMAC_SECRET=test)
npm run test:performance

# Or run directly with k6
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test tests/performance/process-endpoint.js

# High-load test (1000 → 5000 concurrent users, ~3.5 minutes total)
# Make sure your API and database can handle this load!
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test tests/performance/process-endpoint.js

# Quick test with lower load (override stages for testing)
k6 run --env BASE_URL=http://localhost:3000 --env HMAC_SECRET=test \
  --stage 30s:10 --stage 1m:10 \
  tests/performance/process-endpoint.js
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

**Load Profile:**
- Ramp up: 0 → 1,000 users over 30s
- Sustained: 1,000 users for 1 minute
- Ramp up: 1,000 → 5,000 users over 30s
- Sustained: 5,000 users for 1 minute
- Ramp down: 5,000 → 0 users over 30s
- **Total duration: ~3.5 minutes**

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

## Adjusting Load

Edit the `options.stages` in the test file to change:
- Number of virtual users (target)
- Duration of each stage
- Ramp-up/ramp-down patterns

Example for higher load:
```javascript
stages: [
  { duration: '1m', target: 100 },  // 100 concurrent users
  { duration: '2m', target: 100 },
],
```

