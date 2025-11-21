-- Script para verificar nombres/empresas BAN exactos

-- Ver todos los nombres que contienen "BAN"
SELECT id, name, business_name
FROM clients
WHERE (name ILIKE '%BAN%' OR business_name ILIKE '%BAN%')
ORDER BY id
LIMIT 20;

-- Ver cuántos tienen exactamente esos patrones
SELECT 
  COUNT(*) as total_con_ban_en_nombre,
  COUNT(CASE WHEN name ILIKE 'Cliente BAN%' THEN 1 END) as con_nombre_cliente_ban,
  COUNT(CASE WHEN name ILIKE 'BAN%' THEN 1 END) as con_nombre_ban,
  COUNT(CASE WHEN business_name ILIKE 'Empresa BAN%' THEN 1 END) as con_empresa_empresa_ban,
  COUNT(CASE WHEN business_name ILIKE 'BAN%' THEN 1 END) as con_empresa_ban
FROM clients
WHERE (name ILIKE '%BAN%' OR business_name ILIKE '%BAN%');

-- Ver ejemplos específicos
SELECT id, name, business_name
FROM clients
WHERE business_name ILIKE 'Empresa BAN%'
LIMIT 10;

SELECT id, name, business_name
FROM clients
WHERE name ILIKE 'Cliente BAN%'
LIMIT 10;

