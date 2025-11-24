-- VERIFICAR-DUPLICADOS.sql
\echo '📊 CONTEOS ACTUALES:'
SELECT 
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM bans) as total_bans,
    (SELECT COUNT(*) FROM subscribers) as total_subscribers;

\echo '🔍 BUSCANDO DUPLICADOS DE CLIENTES (por Nombre Empresa):'
SELECT business_name, COUNT(*) 
FROM clients 
WHERE business_name IS NOT NULL 
GROUP BY business_name 
HAVING COUNT(*) > 1;

\echo '🔍 BUSCANDO DUPLICADOS DE SUSCRIPTORES (por Teléfono Activo):'
SELECT phone, COUNT(*) 
FROM subscribers 
WHERE is_active = 1 
GROUP BY phone 
HAVING COUNT(*) > 1;

\echo '🔍 BUSCANDO DUPLICADOS DE BAN (por Número):'
SELECT ban_number, COUNT(*) 
FROM bans 
GROUP BY ban_number 
HAVING COUNT(*) > 1;
