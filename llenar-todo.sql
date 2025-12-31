-- LLENAR TODO AUTOMÁTICAMENTE - 6 clientes
BEGIN;

-- 1. Crear BANs para los 2 clientes sin BANs
INSERT INTO bans (client_id, ban_number, status, created_at, updated_at)
SELECT 
  c.id,
  '900' || LPAD((ROW_NUMBER() OVER (ORDER BY c.id))::TEXT, 6, '0') as ban_number,
  'activo',
  NOW(),
  NOW()
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM bans WHERE bans.client_id = c.id
);

-- 2. Crear suscriptores para TODOS los BANs que no tengan
INSERT INTO subscribers (ban_id, phone_number, status, expiration_date, remaining_payments, created_at, updated_at)
SELECT 
  b.id,
  '787' || LPAD((ROW_NUMBER() OVER (ORDER BY b.id))::TEXT, 7, '0') as phone_number,
  'activo',
  NOW() + INTERVAL '12 months',
  0,
  NOW(),
  NOW()
FROM bans b
WHERE NOT EXISTS (
  SELECT 1 FROM subscribers WHERE subscribers.ban_id = b.id
);

COMMIT;

-- Verificar resultado final
SELECT 
  COUNT(*) as total_clientes,
  COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as con_nombre,
  (SELECT COUNT(DISTINCT client_id) FROM bans) as clientes_con_bans,
  (SELECT COUNT(DISTINCT ban_id) FROM subscribers) as bans_con_suscriptores
FROM clients;
