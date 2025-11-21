-- Script para limpiar nombres/empresas auto-generados (BAN)
-- Esto moverá esos clientes a "Incompletos"

-- Primero ver cuántos hay
SELECT 
  COUNT(*) as total_con_nombre_ban,
  COUNT(CASE WHEN name LIKE 'Cliente BAN %' OR name LIKE 'BAN %' THEN 1 END) as con_nombre_ban,
  COUNT(CASE WHEN business_name LIKE 'Empresa BAN %' OR business_name LIKE 'BAN %' THEN 1 END) as con_empresa_ban
FROM clients
WHERE (name LIKE 'Cliente BAN %' OR name LIKE 'BAN %' OR 
       business_name LIKE 'Empresa BAN %' OR business_name LIKE 'BAN %');

-- Actualizar: poner business_name en NULL para esos clientes
UPDATE clients
SET business_name = NULL,
    updated_at = NOW()
WHERE (name LIKE 'Cliente BAN %' OR name LIKE 'BAN %' OR 
       business_name LIKE 'Empresa BAN %' OR business_name LIKE 'BAN %');

-- Verificar cuántos se actualizaron
SELECT COUNT(*) as total_actualizados
FROM clients
WHERE business_name IS NULL 
  AND (name LIKE 'Cliente BAN %' OR name LIKE 'BAN %');

