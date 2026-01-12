#!/bin/bash

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/login.json | jq -r '.token')

echo "=== VERIFICACIÓN FINAL ==="
echo ""
echo "1. STATS desde backend:"
curl -s "http://localhost:3001/api/clients?tab=incomplete" \
  -H "Authorization: Bearer $TOKEN" | jq '.stats'

echo ""
echo "2. Primeros 3 incompletos:"
curl -s "http://localhost:3001/api/clients?tab=incomplete" \
  -H "Authorization: Bearer $TOKEN" | jq '.clients[:3] | .[] | {id, name, ban_numbers}'

echo ""
echo "3. Primeros 3 cancelados:"
curl -s "http://localhost:3001/api/clients?tab=cancelled" \
  -H "Authorization: Bearer $TOKEN" | jq '.clients[:3] | .[] | {id, name, ban_numbers}'

echo ""
echo "✅ Deploy completado. Limpia caché del navegador:"
echo "   - Ctrl+Shift+Delete → Datos de caché"
echo "   - O visita: https://crmp.ss-group.cloud/force-update.html"
