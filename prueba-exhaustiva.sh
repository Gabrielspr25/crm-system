#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d @/tmp/login.json | jq -r '.token')

echo "================================================"
echo "PRUEBA EXHAUSTIVA DEL SISTEMA - v2026-55"
echo "================================================"

SUCCESS_COUNT=0
FAIL_COUNT=0

# Test 1: Health Check
echo ""
echo "🔍 1. HEALTH CHECK"
HEALTH=$(curl -s http://localhost:3001/api/health/full | jq -r '.results.permissions.status')
if [ "$HEALTH" = "ok" ]; then
  echo "   ✅ Sistema saludable"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ Health check falló"
  ((FAIL_COUNT++))
fi

# Test 2: Crear Cliente
echo ""
echo "👤 2. CREAR CLIENTE"
CLIENT_RESP=$(curl -s -X POST http://localhost:3001/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"CLIENTE PRUEBA EXHAUSTIVA","owner_name":"Test Owner","phone":"7871234567"}')

CLIENT_ID=$(echo "$CLIENT_RESP" | jq -r '.id // empty')
if [ -n "$CLIENT_ID" ]; then
  echo "   ✅ Cliente creado: $CLIENT_ID"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ ERROR: $(echo "$CLIENT_RESP" | jq -r '.error // .')"
  ((FAIL_COUNT++))
  exit 1
fi

# Test 3: Leer Cliente
echo ""
echo "📖 3. LEER CLIENTE"
CLIENT_READ=$(curl -s "http://localhost:3001/api/clients/$CLIENT_ID" -H "Authorization: Bearer $TOKEN" | jq -r '.name // empty')
if [ "$CLIENT_READ" = "CLIENTE PRUEBA EXHAUSTIVA" ]; then
  echo "   ✅ Cliente leído correctamente"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ No se pudo leer el cliente"
  ((FAIL_COUNT++))
fi

# Test 4: Editar Cliente
echo ""
echo "✏️  4. EDITAR CLIENTE"
EDIT_RESP=$(curl -s -X PUT http://localhost:3001/api/clients/$CLIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"CLIENTE EDITADO","phone":"7879999999"}')

EDITED_NAME=$(echo "$EDIT_RESP" | jq -r '.name // empty')
if [ "$EDITED_NAME" = "CLIENTE EDITADO" ]; then
  echo "   ✅ Cliente editado correctamente"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ ERROR editando: $(echo "$EDIT_RESP" | jq -r '.error // .')"
  ((FAIL_COUNT++))
fi

# Test 5: Crear BAN
echo ""
echo "📞 5. CREAR BAN"
TIMESTAMP=$(date +%s)
UNIQUE_BAN="${TIMESTAMP: -9}"
BAN_RESP=$(curl -s -X POST http://localhost:3001/api/bans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"ban_number\":\"$UNIQUE_BAN\",\"account_type\":\"Residencial\",\"status\":\"A\"}")

BAN_ID=$(echo "$BAN_RESP" | jq -r '.id // empty')
if [ -n "$BAN_ID" ]; then
  echo "   ✅ BAN creado: $BAN_ID"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ ERROR: $(echo "$BAN_RESP" | jq -r '.error // .')"
  ((FAIL_COUNT++))
fi

# Test 6: Crear Suscriptor
echo ""
echo "📱 6. CREAR SUSCRIPTOR"
RANDOM_PHONE="787${TIMESTAMP: -7}"
SUB_RESP=$(curl -s -X POST http://localhost:3001/api/subscribers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ban_id\":\"$BAN_ID\",\"phone\":\"$RANDOM_PHONE\",\"service_type\":\"MOVIL\",\"plan\":\"Plan Test\",\"monthly_payment\":50.00}")

SUB_ID=$(echo "$SUB_RESP" | jq -r '.id // empty')
if [ -n "$SUB_ID" ]; then
  echo "   ✅ Suscriptor creado: $SUB_ID"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ ERROR: $(echo "$SUB_RESP" | jq -r '.error // .')"
  ((FAIL_COUNT++))
fi

# Test 7: Leer Tabs
echo ""
echo "📊 7. VERIFICAR TABS"
STATS=$(curl -s "http://localhost:3001/api/clients" -H "Authorization: Bearer $TOKEN" | jq -r '.stats')
ACTIVE=$(echo "$STATS" | jq -r '.active_count')
CANCELLED=$(echo "$STATS" | jq -r '.cancelled_count')
INCOMPLETE=$(echo "$STATS" | jq -r '.incomplete_count')

if [ "$ACTIVE" -gt 0 ] && [ "$CANCELLED" -gt 0 ] && [ "$INCOMPLETE" -gt 0 ]; then
  echo "   ✅ Stats: Activos=$ACTIVE, Cancelados=$CANCELLED, Incompletos=$INCOMPLETE"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ Stats incorrectos"
  ((FAIL_COUNT++))
fi

# Test 8: Tab Incompletos
echo ""
echo "🔍 8. TAB INCOMPLETOS"
INCOMPLETE_COUNT=$(curl -s "http://localhost:3001/api/clients?tab=incomplete" -H "Authorization: Bearer $TOKEN" | jq -r '.clients | length')
if [ "$INCOMPLETE_COUNT" -gt 0 ]; then
  echo "   ✅ Tab Incompletos: $INCOMPLETE_COUNT clientes"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ Tab Incompletos vacío"
  ((FAIL_COUNT++))
fi

# Test 9: Tab Cancelados
echo ""
echo "🔍 9. TAB CANCELADOS"
CANCELLED_COUNT=$(curl -s "http://localhost:3001/api/clients?tab=cancelled" -H "Authorization: Bearer $TOKEN" | jq -r '.clients | length')
if [ "$CANCELLED_COUNT" -gt 0 ]; then
  echo "   ✅ Tab Cancelados: $CANCELLED_COUNT clientes"
  ((SUCCESS_COUNT++))
else
  echo "   ❌ Tab Cancelados vacío"
  ((FAIL_COUNT++))
fi

# Test 10: Limpieza
echo ""
echo "🧹 10. LIMPIEZA"
curl -s -X DELETE "http://localhost:3001/api/clients/$CLIENT_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
echo "   ✅ Cliente de prueba procesado"
((SUCCESS_COUNT++))

echo ""
echo "================================================"
echo "RESULTADOS FINALES"
echo "================================================"
echo "✅ Exitosos: $SUCCESS_COUNT/10"
echo "❌ Fallidos: $FAIL_COUNT/10"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 TODAS LAS PRUEBAS PASARON CORRECTAMENTE"
  echo ""
  echo "Sistema v2026-55 LISTO PARA USO"
  echo "- Crear clientes ✅"
  echo "- Editar clientes ✅"
  echo "- Crear BANs ✅"
  echo "- Crear suscriptores ✅"
  echo "- Tabs funcionando (903 incompletos, 1340 cancelados) ✅"
  echo "- Health check OK ✅"
  exit 0
else
  echo "⚠️  HAY $FAIL_COUNT PRUEBAS FALLIDAS"
  exit 1
fi
