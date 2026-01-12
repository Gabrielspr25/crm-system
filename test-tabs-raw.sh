#!/bin/bash

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"1234"}' | jq -r '.accessToken')

echo "Token: $TOKEN"
echo ""

echo "=== RAW RESPONSE ==="
curl -s "http://localhost:3001/api/clients?tab=incomplete" \
  -H "Authorization: Bearer $TOKEN"
