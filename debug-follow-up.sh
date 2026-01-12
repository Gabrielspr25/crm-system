#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d @/tmp/login.json | jq -r '.token')

echo "Token: ${TOKEN:0:20}..."
echo ""

# Usar cliente existente
CLIENT_ID="2bb1a9ed-4eb8-4aa6-ab77-b188285e2b24"

echo "Testing follow-up creation..."
RESPONSE=$(curl -v -X POST http://localhost:3001/api/follow-up-prospects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$CLIENT_ID\"}" 2>&1)

echo "$RESPONSE"
