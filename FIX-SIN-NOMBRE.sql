-- Actualizar clientes con 'SIN NOMBRE' a NULL
UPDATE clients SET name = NULL WHERE name = 'SIN NOMBRE';

-- Verificar cuántos quedaron sin nombre
SELECT 'Total clientes sin nombre' as resultado, COUNT(*) as total 
FROM clients 
WHERE name IS NULL OR name = '';
