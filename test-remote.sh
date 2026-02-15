#!/bin/bash
curl -s -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d "{\"username\":\"gabriel.sanchez@claropr.com\",\"password\":\"admin123\"}" > /tmp/login.json
TOKEN=$(python3 -c "import json; print(json.load(open(
\/tmp/login.json\')).get(\accessToken\',\NONE\'))")
curl -s "http://localhost:3001/api/clients?tab=active" -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(\Total:\',len(d.get(\clients\',[])));" 
