-- Limpieza de BANs con status NULL.
-- Pre-requisito: revisar primero scripts/diagnostico/bans-status-null.sql.
-- Despues de revisar caso por caso, descomenta el UPDATE que corresponda
-- y ejecuta dentro de una transaccion.

BEGIN;

-- Variante A: marcar como ACTIVOS los BANs con suscriptores activos.
-- UPDATE bans b
--    SET status = 'A', updated_at = NOW()
--  WHERE b.status IS NULL
--    AND EXISTS (
--        SELECT 1 FROM subscribers s
--         WHERE s.ban_id = b.id AND s.status = 'activo'
--    );

-- Variante B: marcar como CANCELADOS los BANs sin suscriptores activos.
-- UPDATE bans b
--    SET status = 'C', updated_at = NOW()
--  WHERE b.status IS NULL
--    AND NOT EXISTS (
--        SELECT 1 FROM subscribers s
--         WHERE s.ban_id = b.id AND s.status = 'activo'
--    );

-- Variante C (forzada): asignar 'A' a todos los NULL (solo si revisaste y son activos).
-- UPDATE bans SET status = 'A', updated_at = NOW() WHERE status IS NULL;

-- Verificacion post-limpieza (debe devolver 0)
SELECT COUNT(*) AS bans_status_null_post FROM bans WHERE status IS NULL;

-- Si el conteo es 0, hacer COMMIT. Si no, ROLLBACK y revisar.
-- COMMIT;
ROLLBACK;
