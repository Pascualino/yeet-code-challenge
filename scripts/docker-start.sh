#!/bin/bash
# Start Docker containers

echo "🐳 Starting Yeet Casino services..."
docker compose up -d

echo ""
echo "✅ Services started!"
echo ""
echo "📊 API: http://localhost:3000"
echo ""
echo "To view logs: docker compose logs -f api"
echo "To stop: docker compose down"

