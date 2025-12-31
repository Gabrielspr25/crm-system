-- Contar clientes y ver estado real
SELECT 
  COUNT(*) as total_clientes,
  COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as con_nombre,
  COUNT(CASE WHEN ban_count > 0 THEN 1 END) as con_bans,
  COUNT(CASE WHEN subscriber_count > 0 THEN 1 END) as con_suscriptores
FROM (
  SELECT 
    c.id,
    c.name,
    COUNT(DISTINCT b.id) as ban_count,
    COUNT(DISTINCT s.id) as subscriber_count
  FROM clients c
  LEFT JOIN bans b ON c.id = b.client_id
  LEFT JOIN subscribers s ON b.id = s.ban_id
  GROUP BY c.id, c.name
) datos;
