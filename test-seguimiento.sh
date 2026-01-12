#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d @/tmp/login.json | jq -r '.token')

echo "================================================"
echo "PRUEBA: MOVER CLIENTE A SEGUIMIENTO"
echo "================================================"

# 1. Crear cliente
echo ""
echo "1. Creando cliente..."
TIMESTAMP=$(date +%s)
CLIENT_RESP=$(curl -s -X POST http://localhost:3001/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"CLIENTE PARA SEGUIMIENTO","owner_name":"Juan Test","phone":"7871234567"}')

CLIENT_ID=$(echo "$CLIENT_RESP" | jq -r '.id // empty')
if [ -z "$CLIENT_ID" ]; then
  echo "   ❌ ERROR: $(echo "$CLIENT_RESP" | jq -r '.error // .')"
  exit 1
fi
echo "   ✅ Cliente creado: $CLIENT_ID"

# 2. Crear BAN
echo ""
echo "2. Creando BAN..."
UNIQUE_BAN="${TIMESTAMP: -9}"
BAN_RESP=$(curl -s -X POST http://localhost:3001/api/bans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"ban_number\":\"$UNIQUE_BAN\",\"account_type\":\"Residencial\",\"status\":\"A\"}")

BAN_ID=$(echo "$BAN_RESP" | jq -r '.id // empty')
if [ -z "$BAN_ID" ]; then
  echo "   ❌ ERROR: $(echo "$BAN_RESP" | jq -r '.error // .')"
  exit 1
fi
echo "   ✅ BAN creado: $BAN_ID ($UNIQUE_BAN)"

# 3. Crear suscriptor
echo ""
echo "3. Creando suscriptor..."
RANDOM_PHONE="787${TIMESTAMP: -7}"
SUB_RESP=$(curl -s -X POST http://localhost:3001/api/subscribers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ban_id\":\"$BAN_ID\",\"phone\":\"$RANDOM_PHONE\",\"service_type\":\"MOVIL\",\"plan\":\"Plan Test\",\"monthly_payment\":50.00}")

SUB_ID=$(echo "$SUB_RESP" | jq -r '.id // empty')
if [ -z "$SUB_ID" ]; then
  echo "   ❌ ERROR: $(echo "$SUB_RESP" | jq -r '.error // .')"
  exit 1
fi
echo "   ✅ Suscriptor creado: $SUB_ID ($RANDOM_PHONE)"

# 4. Enviar a seguimiento
echo ""
echo "4. Enviando cliente a seguimiento..."
FOLLOW_FILE=$(mktemp)
cat > "$FOLLOW_FILE" << EOF
{"client_id":"$CLIENT_ID"}
EOF

FOLLOW_RESP=$(curl -s -X POST http://localhost:3001/api/follow-up-prospects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$FOLLOW_FILE")

PROSPECT_ID=$(echo "$FOLLOW_RESP" | jq -r '.id // empty')
if [ -z "$PROSPECT_ID" ]; then
  echo "   ❌ ERROR: $(echo "$FOLLOW_RESP" | jq -r '.error // .')"
  echo "   Response completo: $FOLLOW_RESP"
  rm "$FOLLOW_FILE"
  exit 1
fi
echo "   ✅ Cliente en seguimiento: $PROSPECT_ID"
rm "$FOLLOW_FILE"

# 5. Verificar en tab seguimiento
echo ""
echo "5. Verificando tab 'Siguiendo'..."
FOLLOWING_DATA=$(curl -s "http://localhost:3001/api/clients?tab=following" -H "Authorization: Bearer $TOKEN")
FOLLOWING_COUNT=$(echo "$FOLLOWING_DATA" | jq -r '.clients | length')
CLIENT_IN_FOLLOWING=$(echo "$FOLLOWING_DATA" | jq -r ".clients[] | select(.id == \"$CLIENT_ID\") | .id")

if [ -n "$CLIENT_IN_FOLLOWING" ]; then
  echo "   ✅ Cliente aparece en tab 'Siguiendo'"
  echo "   Total en seguimiento: $FOLLOWING_COUNT"
else
  echo "   ❌ Cliente NO aparece en tab 'Siguiendo'"
  echo "   Total en seguimiento: $FOLLOWING_COUNT"
fi

# 6. Verificar stats
echo ""
echo "6. Verificando estadísticas..."
STATS=$(curl -s "http://localhost:3001/api/clients" -H "Authorization: Bearer $TOKEN" | jq -r '.stats')
FOLLOWING_STAT=$(echo "$STATS" | jq -r '.following_count')
echo "   Estadística following_count: $FOLLOWING_STAT"

echo ""
echo "================================================"
echo "RESUMEN"
echo "================================================"
echo "Cliente ID: $CLIENT_ID"
echo "BAN: $UNIQUE_BAN"
echo "Suscriptor: $RANDOM_PHONE"
echo "Prospect ID: $PROSPECT_ID"
echo ""
echo "✅ Cliente movido a seguimiento correctamente"
echo ""
echo "Para verificar en UI:"
echo "1. Haz refresh en https://crmp.ss-group.cloud/clientes"
echo "2. Click en tab 'Siguiendo'"
echo "3. Busca cliente 'CLIENTE PARA SEGUIMIENTO'"
