#!/bin/bash
# Get current session context
curl "${CREWHUB_API_URL:-http://localhost:8090}/api/sessions/$1/context"
