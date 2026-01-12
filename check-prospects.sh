#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d '{"email":"gabriels.me@gmail.com","password":"Qubit2020!"}' | jq -r '.token')

echo "Total prospects:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/follow-up-prospects | jq 'length'

echo ""
echo "Prospects activos:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/follow-up-prospects | jq '.[] | {id, company_name, client_id, is_active}'
