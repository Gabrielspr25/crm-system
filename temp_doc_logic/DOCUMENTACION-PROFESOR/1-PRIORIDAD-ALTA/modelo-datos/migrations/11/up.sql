-- Script para completar clientes sin BANs y suscriptores
-- Incrementa clientes de incompletos a disponibles

BEGIN;

-- 1. Crear BANs para clientes que no tienen
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
)
ON CONFLICT (ban_number) DO NOTHING;

-- 2. Crear suscriptores para BANs sin suscriptores
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
)
ON CONFLICT (phone_number) DO NOTHING;

-- 3. Asegurar que todos los clientes tengan nombre si está vacío
UPDATE clients 
SET name = COALESCE(business_name, 'Cliente ' || id::TEXT)
WHERE name IS NULL OR name = '';

UPDATE clients
SET business_name = COALESCE(name, 'Empresa ' || id::TEXT)
WHERE business_name IS NULL OR business_name = '';

COMMIT;

-- Verificar resultado
SELECT 
  COUNT(*) as total_clientes,
  COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as con_nombre,
  COUNT(CASE WHEN business_name IS NOT NULL AND business_name != '' THEN 1 END) as con_empresa
FROM clients;

SELECT 
  COUNT(DISTINCT c.id) as clientes_con_bans,
  COUNT(DISTINCT s.ban_id) as bans_con_suscriptores
FROM clients c
LEFT JOIN bans b ON c.id = b.client_id
LEFT JOIN subscribers s ON b.id = s.ban_id
WHERE c.id IS NOT NULL;
