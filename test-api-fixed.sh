#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"gabriel","password":"Qubit2020!"}' | jq -r '.accessToken')

echo "Token length: ${#TOKEN}"

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed"
  exit 1
fi

echo "=== Testing API ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/follow-up-prospects | jq 'if type == "array" then {count: length, samples: .[0:3]} else . end'
