-- Verificar clientes incompletos (sin nombre ni business_name)
SELECT 
    COUNT(*) as total_clients,
    COUNT(CASE WHEN (name IS NULL OR TRIM(name) = '') 
                AND (business_name IS NULL OR TRIM(business_name) = '') 
                THEN 1 END) as incompletos,
    COUNT(CASE WHEN name IS NOT NULL AND TRIM(name) != '' THEN 1 END) as con_name,
    COUNT(CASE WHEN business_name IS NOT NULL AND TRIM(business_name) != '' THEN 1 END) as con_business_name
FROM clients;

\echo '==== EJEMPLOS DE CLIENTES INCOMPLETOS ===='
SELECT 
    id,
    name,
    business_name,
    owner_name,
    email
FROM clients
WHERE (name IS NULL OR TRIM(name) = '') 
  AND (business_name IS NULL OR TRIM(business_name) = '')
LIMIT 10;
