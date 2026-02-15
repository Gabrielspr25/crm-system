#!/bin/bash

echo "=== ESTADÍSTICAS DE CLIENTES EN PRODUCCIÓN ==="
echo ""

# Total de clientes
echo "📊 TOTAL DE CLIENTES:"
sudo -u postgres psql -d crm_pro -t -c "SELECT COUNT(*) FROM clients;"

echo ""
echo "📊 CLIENTES ACTIVOS (con BAN activo y nombre):"
sudo -u postgres psql -d crm_pro -t -c "
SELECT COUNT(DISTINCT c.id) 
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
AND (c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL');
"

echo ""
echo "📊 CLIENTES CANCELADOS (con BAN cancelado y nombre):"
sudo -u postgres psql -d crm_pro -t -c "
SELECT COUNT(DISTINCT c.id) 
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'C')
AND (c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL');
"

echo ""
echo "📊 CLIENTES INCOMPLETOS (sin nombre):"
sudo -u postgres psql -d crm_pro -t -c "
SELECT COUNT(DISTINCT c.id) 
FROM clients c 
WHERE (c.name IS NULL OR c.name = '' OR c.name = 'NULL');
"

echo ""
echo "📊 TOTAL DE BANS:"
sudo -u postgres psql -d crm_pro -t -c "SELECT COUNT(*) FROM bans;"

echo ""
echo "📊 BANS POR STATUS:"
sudo -u postgres psql -d crm_pro -c "SELECT status, COUNT(*) FROM bans GROUP BY status;"

echo ""
echo "📊 TOTAL DE SUBSCRIBERS:"
sudo -u postgres psql -d crm_pro -t -c "SELECT COUNT(*) FROM subscribers;"

echo ""
echo "📊 CLIENTES CON BANS (cualquier status):"
sudo -u postgres psql -d crm_pro -t -c "
SELECT COUNT(DISTINCT c.id) 
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id);
"

echo ""
echo "📊 CLIENTES CON BANS Y NOMBRE:"
sudo -u postgres psql -d crm_pro -t -c "
SELECT COUNT(DISTINCT c.id) 
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
AND (c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL');
"
