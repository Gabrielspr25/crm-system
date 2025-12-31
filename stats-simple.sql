-- Estadísticas simples de clientes
SELECT COUNT(*) as total_clientes FROM clients;

SELECT 
  COUNT(DISTINCT c.id) as clientes_con_bans
FROM clients c
INNER JOIN bans b ON c.id = b.client_id;

SELECT 
  COUNT(DISTINCT c.id) as clientes_sin_business_name
FROM clients c
WHERE c.business_name IS NULL OR c.business_name = '';

SELECT 
  COUNT(DISTINCT c.id) as clientes_sin_nombre
FROM clients c
WHERE c.name IS NULL OR c.name = '';
