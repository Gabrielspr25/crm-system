-- Verificar datos para los tabs
SELECT 'Incompletos (name IS NULL)' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
WHERE c.name IS NULL

UNION ALL

SELECT 'Incompletos con BANs activos' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
  AND c.name IS NULL

UNION ALL

SELECT 'Cancelados' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'C')

UNION ALL

SELECT 'Activos' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
  AND c.name IS NOT NULL;

-- Muestra de incompletos
SELECT c.id, c.name, b.ban_number, b.status 
FROM clients c 
JOIN bans b ON b.client_id = c.id 
WHERE c.name IS NULL 
LIMIT 10;
