-- Script para limpiar nombres/empresas que empiezan con "Empresa BAN"
-- Esto moverá esos clientes a "Incompletos"

-- Primero ver cuántos hay
SELECT 
  COUNT(*) as total_con_empresa_ban
FROM clients
WHERE business_name ILIKE 'Empresa BAN%';

-- Ver ejemplos antes de actualizar
SELECT id, name, business_name
FROM clients
WHERE business_name ILIKE 'Empresa BAN%'
LIMIT 10;

-- Actualizar: poner business_name en NULL para esos clientes
UPDATE clients
SET business_name = NULL,
    updated_at = NOW()
WHERE business_name ILIKE 'Empresa BAN%';

-- Verificar cuántos se actualizaron
SELECT COUNT(*) as total_actualizados
FROM clients
WHERE business_name IS NULL 
  AND (name ILIKE 'Cliente BAN%' OR name ILIKE '%BAN%');


