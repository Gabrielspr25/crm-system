#!/bin/bash

# Login
echo "=== LOGIN ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"gabriels.me@gmail.com","password":"Qubit2020!"}')

echo "$LOGIN_RESPONSE" | jq .

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: No se obtuvo token"
  exit 1
fi

echo ""
echo "Token obtenido: ${TOKEN:0:50}..."
echo ""

# Get prospects
echo "=== GET /api/follow-up-prospects ==="
PROSPECTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/follow-up-prospects)

echo "$PROSPECTS" | jq 'if type == "array" then "Total: \(length)" else . end'
echo ""
echo "Primeros 3:"
echo "$PROSPECTS" | jq '.[0:3] | .[] | {id, company_name, is_active}'
