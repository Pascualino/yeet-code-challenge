#!/bin/bash

echo "🔄 Resetting test database..."

# Drop all data from users table
docker exec yeet-casino-db psql -U postgres -d yeet_casino -c "TRUNCATE TABLE users CASCADE;"

echo "✨ Database cleared"

# Run seed script
npm run db:seed

echo "✅ Test database reset complete!"

