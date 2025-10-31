#!/bin/bash

echo "🔄 Resetting test database..."

# Drop all data from tables
docker exec yeet-casino-db psql -U postgres -d yeet_casino -c "TRUNCATE TABLE actions_ledger, balances CASCADE;"

echo "✨ Database cleared"

npm run db:push
npm run db:seed

echo "✅ Test database reset complete!"

