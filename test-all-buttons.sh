#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d @/tmp/login.json | jq -r '.token')

echo "============================================"
echo "PRUEBA COMPLETA DE TODAS LAS FUNCIONALIDADES"
echo "============================================"
echo ""

# 1. CREAR CLIENTE
echo "1. ✅ CREAR CLIENTE"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TEST EMPRESA PRUEBA",
    "owner_name": "Juan Perez",
    "contact_person": "Maria Lopez",
    "email": "test@test.com",
    "phone": "7871234567"
  }')

if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  CLIENT_ID=$(echo "$RESPONSE" | jq -r '.id')
  echo "   ✅ Cliente creado: $CLIENT_ID"
else
  echo "   ❌ ERROR: $(echo "$RESPONSE" | jq -r '.error // .message // .')"
  exit 1
fi

# 2. EDITAR CLIENTE
echo ""
echo "2. ✅ EDITAR CLIENTE"
EDIT_RESPONSE=$(curl -s -X PUT http://localhost:3001/api/clients/$CLIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TEST EMPRESA EDITADA",
    "phone": "7879999999"
  }')

if echo "$EDIT_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo "   ✅ Cliente editado correctamente"
else
  echo "   ❌ ERROR: $(echo "$EDIT_RESPONSE" | jq -r '.error // .')"
fi

# 3. CREAR BAN
echo ""
echo "3. ✅ CREAR BAN"
BAN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/bans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"ban_number\": \"999888777\",
    \"account_type\": \"Residencial\",
    \"status\": \"A\"
  }")

if echo "$BAN_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  BAN_ID=$(echo "$BAN_RESPONSE" | jq -r '.id')
  echo "   ✅ BAN creado: $BAN_ID"
else
  echo "   ❌ ERROR: $(echo "$BAN_RESPONSE" | jq -r '.error // .')"
  exit 1
fi

# 4. CREAR SUSCRIPTOR
echo ""
echo "4. ✅ CREAR SUSCRIPTOR"
SUB_RESPONSE=$(curl -s -X POST http://localhost:3001/api/subscribers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"ban_id\": \"$BAN_ID\",
    \"phone\": \"7871112222\",
    \"service_type\": \"MOVIL\",
    \"plan\": \"Plan Test\",
    \"monthly_payment\": 50.00
  }")

if echo "$SUB_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo "   ✅ Suscriptor creado"
else
  echo "   ❌ ERROR: $(echo "$SUB_RESPONSE" | jq -r '.error // .')"
fi

# 5. ENVIAR A SEGUIMIENTO
echo ""
echo "5. ✅ ENVIAR A SEGUIMIENTO"
FOLLOW_RESPONSE=$(curl -s -X POST http://localhost:3001/api/follow-up-prospects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\"
  }")

if echo "$FOLLOW_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  PROSPECT_ID=$(echo "$FOLLOW_RESPONSE" | jq -r '.id')
  echo "   ✅ Cliente en seguimiento: $PROSPECT_ID"
else
  echo "   ❌ ERROR: $(echo "$FOLLOW_RESPONSE" | jq -r '.error // .')"
fi

# 6. COMPLETAR SEGUIMIENTO
echo ""
echo "6. ✅ COMPLETAR SEGUIMIENTO"
COMPLETE_RESPONSE=$(curl -s -X PUT http://localhost:3001/api/follow-up-prospects/$PROSPECT_ID/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if echo "$COMPLETE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "   ✅ Seguimiento completado"
else
  echo "   ❌ ERROR: $(echo "$COMPLETE_RESPONSE" | jq -r '.error // .')"
fi

# 7. HEALTH CHECK
echo ""
echo "7. ✅ HEALTH CHECK"
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health/full)
PERMISSIONS=$(echo "$HEALTH_RESPONSE" | jq -r '.results.permissions.status')

if [ "$PERMISSIONS" = "ok" ]; then
  echo "   ✅ Health check: OK"
else
  echo "   ❌ Permissions: $(echo "$HEALTH_RESPONSE" | jq -r '.results.permissions.message')"
fi

# 8. LIMPIAR (BORRAR CLIENTE DE PRUEBA)
echo ""
echo "8. 🧹 LIMPIEZA"
DELETE_RESPONSE=$(curl -s -X DELETE http://localhost:3001/api/clients/$CLIENT_ID \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "   ✅ Cliente de prueba eliminado"
else
  echo "   ⚠️  No se pudo eliminar (normal si tiene referencias)"
fi

echo ""
echo "============================================"
echo "✅ PRUEBA COMPLETA FINALIZADA"
echo "============================================"
