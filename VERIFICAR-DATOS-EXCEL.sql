-- Verificación de datos: Activos vs Cancelados con/sin datos

-- 1. Activos con al menos 1 dato (Nombre, Apellido o EMPRESA)
SELECT 'Activos con datos' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
JOIN bans b ON b.client_id = c.id 
WHERE b.status = 'A' 
AND (
  (c.name IS NOT NULL AND c.name != '') 
  OR (c.owner_name IS NOT NULL AND c.owner_name != '') 
  OR (c.contact_person IS NOT NULL AND c.contact_person != '')
);

-- 2. Activos sin ningún dato (las 3 vacías)
SELECT 'Activos sin datos' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
JOIN bans b ON b.client_id = c.id 
WHERE b.status = 'A' 
AND (c.name IS NULL OR c.name = '') 
AND (c.owner_name IS NULL OR c.owner_name = '') 
AND (c.contact_person IS NULL OR c.contact_person = '');

-- 3. Cancelados con al menos 1 dato
SELECT 'Cancelados con datos' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
JOIN bans b ON b.client_id = c.id 
WHERE b.status = 'C' 
AND (
  (c.name IS NOT NULL AND c.name != '') 
  OR (c.owner_name IS NOT NULL AND c.owner_name != '') 
  OR (c.contact_person IS NOT NULL AND c.contact_person != '')
);

-- 4. Cancelados sin ningún dato
SELECT 'Cancelados sin datos' as tipo, COUNT(DISTINCT c.id) as total
FROM clients c 
JOIN bans b ON b.client_id = c.id 
WHERE b.status = 'C' 
AND (c.name IS NULL OR c.name = '') 
AND (c.owner_name IS NULL OR c.owner_name = '') 
AND (c.contact_person IS NULL OR c.contact_person = '');

-- 5. Totales por status (para verificar)
SELECT 
  b.status,
  COUNT(DISTINCT c.id) as total_clientes,
  COUNT(DISTINCT b.id) as total_bans,
  COUNT(DISTINCT CASE WHEN (c.name IS NOT NULL AND c.name != '') 
    OR (c.owner_name IS NOT NULL AND c.owner_name != '') 
    OR (c.contact_person IS NOT NULL AND c.contact_person != '') 
    THEN c.id END) as con_datos,
  COUNT(DISTINCT CASE WHEN (c.name IS NULL OR c.name = '') 
    AND (c.owner_name IS NULL OR c.owner_name = '') 
    AND (c.contact_person IS NULL OR c.contact_person = '') 
    THEN c.id END) as sin_datos
FROM clients c 
JOIN bans b ON b.client_id = c.id 
GROUP BY b.status
ORDER BY b.status;
