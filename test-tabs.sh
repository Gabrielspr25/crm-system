#!/bin/bash

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/login.json | jq -r '.token')

echo "=== STATS ==="
curl -s "http://localhost:3001/api/clients" \
  -H "Authorization: Bearer $TOKEN" | jq '.stats'

echo ""
echo "=== INCOMPLETOS (cantidad) ==="
curl -s "http://localhost:3001/api/clients?tab=incomplete" \
  -H "Authorization: Bearer $TOKEN" | jq '.clients | length'

echo ""
echo "=== CANCELADOS (cantidad) ==="
curl -s "http://localhost:3001/api/clients?tab=cancelled" \
  -H "Authorization: Bearer $TOKEN" | jq '.clients | length'
