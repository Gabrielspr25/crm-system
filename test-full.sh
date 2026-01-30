#!/bin/bash

echo "🔍 TEST COMPLETO DEL SISTEMA"
echo ""

# 1. Health
echo "1. Health check..."
HEALTH=$(curl -s http://localhost:3001/api/health)
echo "   $HEALTH"

# 2. Login con usuario real
echo ""
echo "2. Login como 'admin'..."
LOGIN=$(curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Ventaspro12*"}')
echo "   Response: ${LOGIN:0:100}..."

TOKEN=$(echo $LOGIN | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "   ❌ Login falló"
  exit 1
fi

echo "   ✅ Token: ${TOKEN:0:30}..."

# 3. Test productos
echo ""
echo "3. GET /api/products con token..."
PRODUCTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/products)
PROD_COUNT=$(echo $PRODUCTS | grep -o '"id"' | wc -l)
echo "   Productos encontrados: $PROD_COUNT"
echo "   Response: ${PRODUCTS:0:200}..."

# 4. Test completed-prospects
echo ""
echo "4. GET /api/completed-prospects con token..."
PROSPECTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/completed-prospects)
PROSP_COUNT=$(echo $PROSPECTS | grep -o '"id"' | wc -l)
echo "   Prospects encontrados: $PROSP_COUNT"
echo "   Response: ${PROSPECTS:0:200}..."

# 5. Test vendors
echo ""
echo "5. GET /api/vendors con token..."
VENDORS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/vendors)
VEND_COUNT=$(echo $VENDORS | grep -o '"id"' | wc -l)
echo "   Vendors encontrados: $VEND_COUNT"

echo ""
echo "✅ TEST COMPLETO"
