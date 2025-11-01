#!/bin/bash

# Performance test runner with configurable load profile
# Usage: ./run-high-load.sh [easy|mid|hard]

set -e

LOAD_PROFILE="${1:-hard}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
HMAC_SECRET="${HMAC_SECRET:-test}"

case "$LOAD_PROFILE" in
  easy)
    echo "🚀 Starting performance test (EASY profile)"
    echo "   Target: 10 → 50 concurrent users"
    ;;
  mid)
    echo "🚀 Starting performance test (MID profile)"
    echo "   Target: 100 → 500 concurrent users"
    ;;
  hard)
    echo "🚀 Starting performance test (HARD profile)"
    echo "   Target: 1000 → 5000 concurrent users"
    echo "   ⚠️  Make sure your API and database can handle this load!"
    ;;
  *)
    echo "❌ Invalid load profile: $LOAD_PROFILE"
    echo "   Usage: $0 [easy|mid|hard]"
    exit 1
    ;;
esac

echo "   API: $BASE_URL"
echo "   Profile: $LOAD_PROFILE"
echo ""

# Check if K6 is available
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 not found. Using Docker..."
    docker run --rm -i --network host \
        -v "$(pwd):/scripts" \
        -e BASE_URL="$BASE_URL" \
        -e HMAC_SECRET="$HMAC_SECRET" \
        -e LOAD_PROFILE="$LOAD_PROFILE" \
        grafana/k6 run /scripts/tests/performance/process-endpoint.js
else
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --env HMAC_SECRET="$HMAC_SECRET" \
        --env LOAD_PROFILE="$LOAD_PROFILE" \
        tests/performance/process-endpoint.js
fi

