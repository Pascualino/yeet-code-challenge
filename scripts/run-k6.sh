#!/bin/bash

# Default values
BASE_URL=${BASE_URL:-http://localhost:3000}
HMAC_SECRET=${HMAC_SECRET:-test}
LOAD_PROFILE=${LOAD_PROFILE:-easy}
TEST_FILE=${1:-tests/performance/process-endpoint.js}

docker run --rm -i --network host \
  -v "$(pwd):/scripts" \
  -e BASE_URL="$BASE_URL" \
  -e HMAC_SECRET="$HMAC_SECRET" \
  -e LOAD_PROFILE="$LOAD_PROFILE" \
  grafana/k6 run "/scripts/$TEST_FILE"

