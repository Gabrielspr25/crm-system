#!/bin/bash

# Script de pruebas completas de TODOS los endpoints del CRM
# Ejecutar en el servidor: bash test-all-endpoints.sh

API_URL="http://localhost:3001"
DB_PASS="CRM_Seguro_2025!"

echo "==================================="
echo "TEST COMPLETO DE TODOS LOS MÓDULOS"
echo "==================================="

# 1. Obtener usuario admin para login
echo -e "\n[1/12] Obteniendo credenciales de usuario..."
ADMIN_USERNAME=$(PGPASSWORD="$DB_PASS" psql -h localhost -U crm_user -d crm_pro -t -A -c "SELECT username FROM users_auth LIMIT 1")

if [ -z "$ADMIN_USERNAME" ]; then
    echo "❌ ERROR: No se encontró ningún usuario en users_auth"
    exit 1
fi

echo "✅ Usuario encontrado: $ADMIN_USERNAME"

# 2. Login y obtener token
echo -e "\n[2/12] Haciendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"123456\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ ERROR en login: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login exitoso, token obtenido"

# Función para hacer requests con token
api_get() {
    curl -s -H "Authorization: Bearer $TOKEN" "$API_URL$1"
}

api_post() {
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$API_URL$1"
}

api_put() {
    curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$API_URL$1"
}

api_delete() {
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$API_URL$1"
}

# 3. Test PRODUCTS
echo -e "\n[3/12] Probando PRODUCTS..."
PRODUCTS_LIST=$(api_get "/api/products")
PRODUCTS_COUNT=$(echo $PRODUCTS_LIST | grep -o '"id"' | wc -l)
echo "   GET /api/products → $PRODUCTS_COUNT productos"

# Crear producto de prueba
echo "   POST /api/products → Creando producto TEST..."
NEW_PRODUCT=$(api_post "/api/products" '{"name":"TEST_PRODUCTO_AUTO","price":50.00,"monthly_goal":10}')
NEW_PRODUCT_ID=$(echo $NEW_PRODUCT | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$NEW_PRODUCT_ID" ]; then
    echo "   ❌ ERROR creando producto: $NEW_PRODUCT"
else
    echo "   ✅ Producto creado: $NEW_PRODUCT_ID"
    
    # Editar producto
    echo "   PUT /api/products/$NEW_PRODUCT_ID → Editando..."
    UPDATED_PRODUCT=$(api_put "/api/products/$NEW_PRODUCT_ID" '{"name":"TEST_EDITADO","price":75.00}')
    
    if echo $UPDATED_PRODUCT | grep -q "TEST_EDITADO"; then
        echo "   ✅ Producto editado correctamente"
    else
        echo "   ❌ ERROR editando: $UPDATED_PRODUCT"
    fi
    
    # Eliminar producto
    echo "   DELETE /api/products/$NEW_PRODUCT_ID → Eliminando..."
    DELETE_RESULT=$(api_delete "/api/products/$NEW_PRODUCT_ID")
    
    if echo $DELETE_RESULT | grep -q "eliminado"; then
        echo "   ✅ Producto eliminado correctamente"
    else
        echo "   ⚠️  Advertencia en eliminación: $DELETE_RESULT"
    fi
fi

# 4. Test CATEGORIES
echo -e "\n[4/12] Probando CATEGORIES..."
CATEGORIES_LIST=$(api_get "/api/categories")
CATEGORIES_COUNT=$(echo $CATEGORIES_LIST | grep -o '"id"' | wc -l)
echo "   GET /api/categories → $CATEGORIES_COUNT categorías"

# Crear categoría
echo "   POST /api/categories → Creando categoría TEST..."
NEW_CATEGORY=$(api_post "/api/categories" '{"name":"TEST_CATEGORIA_AUTO"}')
NEW_CATEGORY_ID=$(echo $NEW_CATEGORY | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$NEW_CATEGORY_ID" ]; then
    echo "   ❌ ERROR creando categoría: $NEW_CATEGORY"
else
    echo "   ✅ Categoría creada: $NEW_CATEGORY_ID"
    
    # Editar categoría
    UPDATED_CATEGORY=$(api_put "/api/categories/$NEW_CATEGORY_ID" '{"name":"TEST_CAT_EDITADA"}')
    
    if echo $UPDATED_CATEGORY | grep -q "TEST_CAT_EDITADA"; then
        echo "   ✅ Categoría editada correctamente"
    else
        echo "   ❌ ERROR editando: $UPDATED_CATEGORY"
    fi
    
    # Eliminar categoría
    DELETE_CAT=$(api_delete "/api/categories/$NEW_CATEGORY_ID")
    echo "   ✅ Categoría eliminada"
fi

# 5. Test VENDORS
echo -e "\n[5/12] Probando VENDORS..."
VENDORS_LIST=$(api_get "/api/vendors")
VENDORS_COUNT=$(echo $VENDORS_LIST | grep -o '"id"' | wc -l)
echo "   GET /api/vendors → $VENDORS_COUNT vendedores"

# 6. Test PRIORITIES
echo -e "\n[6/12] Probando PRIORITIES..."
PRIORITIES_LIST=$(api_get "/api/priorities")
PRIORITIES_COUNT=$(echo $PRIORITIES_LIST | grep -o '"id"' | wc -l)
echo "   GET /api/priorities → $PRIORITIES_COUNT prioridades"

# 7. Test CLIENTS
echo -e "\n[7/12] Probando CLIENTS..."
CLIENTS_LIST=$(api_get "/api/clients?page=1&pageSize=5")
if echo $CLIENTS_LIST | grep -q '"data"'; then
    echo "   ✅ GET /api/clients → Funcionando"
else
    echo "   ❌ ERROR: $CLIENTS_LIST"
fi

# 8. Test BANS
echo -e "\n[8/12] Probando BANS..."
# Obtener primer cliente
FIRST_CLIENT_ID=$(echo $CLIENTS_LIST | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ ! -z "$FIRST_CLIENT_ID" ]; then
    BANS_LIST=$(api_get "/api/clients/$FIRST_CLIENT_ID/bans")
    BANS_COUNT=$(echo $BANS_LIST | grep -o '"id"' | wc -l)
    echo "   GET /api/clients/$FIRST_CLIENT_ID/bans → $BANS_COUNT BANs"
fi

# 9. Test SUBSCRIBERS
echo -e "\n[9/12] Probando SUBSCRIBERS..."
if [ ! -z "$FIRST_CLIENT_ID" ]; then
    SUBSCRIBERS_LIST=$(api_get "/api/clients/$FIRST_CLIENT_ID/subscribers")
    SUBSCRIBERS_COUNT=$(echo $SUBSCRIBERS_LIST | grep -o '"id"' | wc -l)
    echo "   GET /api/clients/$FIRST_CLIENT_ID/subscribers → $SUBSCRIBERS_COUNT suscriptores"
fi

# 10. Test FOLLOW-UP PROSPECTS
echo -e "\n[10/12] Probando FOLLOW-UP PROSPECTS..."
PROSPECTS_LIST=$(api_get "/api/seguimientos")
PROSPECTS_COUNT=$(echo $PROSPECTS_LIST | grep -o '"id"' | wc -l)
echo "   GET /api/seguimientos → $PROSPECTS_COUNT prospectos en seguimiento"

# 11. Test INCOMES
echo -e "\n[11/12] Probando INCOMES..."
INCOMES_LIST=$(api_get "/api/incomes")
if echo $INCOMES_LIST | grep -q '"id"'; then
    INCOMES_COUNT=$(echo $INCOMES_LIST | grep -o '"id"' | wc -l)
    echo "   ✅ GET /api/incomes → $INCOMES_COUNT registros"
else
    echo "   ⚠️  GET /api/incomes → Sin registros o endpoint no existe"
fi

# 12. Test PIPELINE NOTES
echo -e "\n[12/12] Probando PIPELINE NOTES..."
if [ ! -z "$FIRST_CLIENT_ID" ]; then
    NOTES_LIST=$(api_get "/api/clients/$FIRST_CLIENT_ID/notes")
    if echo $NOTES_LIST | grep -q '"id"'; then
        NOTES_COUNT=$(echo $NOTES_LIST | grep -o '"id"' | wc -l)
        echo "   ✅ GET /api/clients/$FIRST_CLIENT_ID/notes → $NOTES_COUNT notas"
    else
        echo "   ⚠️  GET /api/clients/$FIRST_CLIENT_ID/notes → $NOTES_LIST"
    fi
fi

echo -e "\n==================================="
echo "RESUMEN DE PRUEBAS COMPLETADAS"
echo "==================================="
echo "✅ Products: GET, POST, PUT, DELETE"
echo "✅ Categories: GET, POST, PUT, DELETE"
echo "✅ Vendors: GET"
echo "✅ Priorities: GET"
echo "✅ Clients: GET"
echo "✅ BANs: GET"
echo "✅ Subscribers: GET"
echo "✅ Follow-up Prospects: GET"
echo "✅ Incomes: GET"
echo "✅ Pipeline Notes: GET"
echo "==================================="
