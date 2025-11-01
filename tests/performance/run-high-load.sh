#!/bin/bash

# High-load performance test runner
# Tests with 1000 → 5000 concurrent users
# Make sure your API and database are ready for this load!

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
HMAC_SECRET="${HMAC_SECRET:-test}"

echo "🚀 Starting high-load performance test"
echo "   Target: 1000 → 5000 concurrent users"
echo "   Duration: ~3.5 minutes"
echo "   API: $BASE_URL"
echo ""
echo "⚠️  Make sure your API and database can handle this load!"
echo ""

# Check if K6 is available
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 not found. Installing via Docker..."
    docker run --rm -i --network host \
        -v "$(pwd):/scripts" \
        -e BASE_URL="$BASE_URL" \
        -e HMAC_SECRET="$HMAC_SECRET" \
        grafana/k6 run /scripts/tests/performance/process-endpoint.js
else
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --env HMAC_SECRET="$HMAC_SECRET" \
        tests/performance/process-endpoint.js
fi

