-- Verificar clientes sin nombre
SELECT 
    COUNT(*) as total_clientes,
    COUNT(CASE WHEN name IS NULL OR TRIM(name) = '' THEN 1 END) as sin_nombre
FROM clients;

\echo '==== PRIMEROS 5 CLIENTES SIN NOMBRE ===='
SELECT id, owner_name, contact_person, email
FROM clients
WHERE name IS NULL OR TRIM(name) = ''
LIMIT 5;
