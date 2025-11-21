-- ================================================
-- LIMPIAR BD - Clientes, BANs y Suscriptores
-- ================================================
-- ⚠️ ADVERTENCIA: Este script BORRARÁ TODOS los datos
-- ================================================

-- 1. Ver registros antes de borrar
SELECT 
    'ANTES DE BORRAR' as estado,
    (SELECT COUNT(*) FROM subscribers) as total_subscribers,
    (SELECT COUNT(*) FROM bans) as total_bans,
    (SELECT COUNT(*) FROM clients) as total_clients;

-- 2. Borrar en orden (respetando foreign keys)
-- Primero suscriptores (dependen de bans)
DELETE FROM subscribers;

-- Luego bans (dependen de clients)
DELETE FROM bans;

-- Finalmente clients
DELETE FROM clients;

-- 3. Verificar que se borraron
SELECT 
    'DESPUÉS DE BORRAR' as estado,
    (SELECT COUNT(*) FROM subscribers) as remaining_subscribers,
    (SELECT COUNT(*) FROM bans) as remaining_bans,
    (SELECT COUNT(*) FROM clients) as remaining_clients;

-- 4. Opcional: Resetear secuencias (para que los IDs empiecen desde 1)
-- ALTER SEQUENCE clients_id_seq RESTART WITH 1;
-- ALTER SEQUENCE bans_id_seq RESTART WITH 1;
-- ALTER SEQUENCE subscribers_id_seq RESTART WITH 1;
