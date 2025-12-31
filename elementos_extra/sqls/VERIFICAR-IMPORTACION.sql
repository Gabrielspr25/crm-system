-- VERIFICAR-IMPORTACION.sql
\echo '📊 CONTEOS TOTALES:'
SELECT 
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM bans) as total_bans,
    (SELECT COUNT(*) FROM subscribers) as total_subscribers;

\echo '📅 ACTIVIDAD RECIENTE (Últimas 24h):'
SELECT 
    (SELECT COUNT(*) FROM clients WHERE created_at > NOW() - INTERVAL '24 hours') as new_clients,
    (SELECT COUNT(*) FROM bans WHERE created_at > NOW() - INTERVAL '24 hours') as new_bans,
    (SELECT COUNT(*) FROM subscribers WHERE created_at > NOW() - INTERVAL '24 hours') as new_subscribers,
    (SELECT COUNT(*) FROM clients WHERE updated_at > NOW() - INTERVAL '24 hours') as updated_clients;

\echo '📝 ÚLTIMOS 5 CLIENTES CREADOS:'
SELECT id, name, business_name, created_at 
FROM clients 
ORDER BY created_at DESC 
LIMIT 5;
