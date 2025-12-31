-- Estadísticas de clientes actuales
SELECT 
  'ACTIVOS' as tipo,
  COUNT(*) as cantidad
FROM clients c
WHERE COALESCE(c.is_active, 1) = 1

UNION ALL

SELECT 
  'CANCELADOS' as tipo,
  COUNT(*) as cantidad
FROM clients c
WHERE COALESCE(c.is_active, 1) = 0

UNION ALL

SELECT 
  'CON BAN PERO SIN EMPRESA' as tipo,
  COUNT(DISTINCT c.id) as cantidad
FROM clients c
INNER JOIN bans b ON c.id = b.client_id
WHERE (c.business_name IS NULL OR c.business_name = '')
  AND (c.name IS NOT NULL AND c.name != '')

UNION ALL

SELECT 
  'CON BAN PERO SIN NOMBRE' as tipo,
  COUNT(DISTINCT c.id) as cantidad
FROM clients c
INNER JOIN bans b ON c.id = b.client_id
WHERE (c.name IS NULL OR c.name = '')
  AND (c.business_name IS NOT NULL AND c.business_name != '')

UNION ALL

SELECT 
  'CON BAN PERO SIN NOMBRE NI EMPRESA' as tipo,
  COUNT(DISTINCT c.id) as cantidad
FROM clients c
INNER JOIN bans b ON c.id = b.client_id
WHERE (c.name IS NULL OR c.name = '')
  AND (c.business_name IS NULL OR c.business_name = '');
