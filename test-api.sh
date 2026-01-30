#!/bin/bash

# Obtener token de administrador
echo "🔐 Obteniendo token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.com","password":"admin123"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ No se pudo obtener token"
  exit 1
fi

echo "✅ Token obtenido"

# Probar productos
echo ""
echo "📦 Probando /api/products..."
PRODUCTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/products)
echo "Response: $PRODUCTS"
echo "Length: ${#PRODUCTS}"

# Probar completed-prospects
echo ""
echo "💰 Probando /api/completed-prospects..."
PROSPECTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/completed-prospects)
echo "Response: $PROSPECTS"
echo "Length: ${#PROSPECTS}"

# Probar tiers
echo ""
echo "📊 Probando /api/products/tiers..."
TIERS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/products/tiers)
echo "Response: $TIERS"
echo "Length: ${#TIERS}"

# Probar vendors
echo ""
echo "👥 Probando /api/vendors..."
VENDORS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/vendors)
echo "Response: $VENDORS"
echo "Length: ${#VENDORS}"
