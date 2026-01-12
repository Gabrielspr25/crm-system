#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d @/tmp/login2.json | jq -r '.token')

echo "Token length: ${#TOKEN}"
echo ""

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/follow-up-prospects | jq .
