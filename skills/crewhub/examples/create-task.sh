#!/bin/bash
# Create a task in CrewHub
curl -X POST "${CREWHUB_API_URL:-http://localhost:8090}/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"$1\", \"title\": \"$2\", \"description\": \"$3\", \"priority\": \"${4:-medium}\"}"
