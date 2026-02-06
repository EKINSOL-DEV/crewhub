#!/bin/bash
# Update task status
curl -X PATCH "${CREWHUB_API_URL:-http://localhost:8090}/api/tasks/$1" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"$2\"}"
