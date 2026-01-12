#!/bin/bash

# Get proper token
echo "{\"email\":\"gabriels.me@gmail.com\",\"password\":\"Qubit2020!\"}" > /tmp/creds.json

TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/creds.json | jq -r '.accessToken // .token')

echo "Token: ${TOKEN:0:30}..."
echo ""

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed"
  curl -s -X POST http://localhost:3001/api/login \
    -H 'Content-Type: application/json' \
    -d @/tmp/creds.json | jq .
  exit 1
fi

echo "=== GET /api/follow-up-prospects ==="
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/follow-up-prospects)

echo "$RESPONSE" | jq 'if type == "array" then {count: length, first_3: .[0:3] | map({id, company_name, is_active})} else . end'
