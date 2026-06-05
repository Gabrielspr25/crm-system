-- ============================================================================
-- VentasProui - Rollback limpieza follow_up_prospects stale
-- Fecha: 2026-06-05
-- Requiere:
--   Tabla follow_up_prospects_cleanup_backup_20260605 creada por el script:
--   scripts/migraciones/2026-06-05-desactivar-followups-stale.sql
--
-- Restaura SOLO los 15 follow_up_prospects respaldados.
-- No toca clients.
-- No toca bans.
-- No toca SOV2.
-- ============================================================================

BEGIN;

-- Antes del rollback.
SELECT
  'ANTES_ROLLBACK' AS etapa,
  fp.id AS follow_up_id,
  fp.client_id,
  fp.is_active,
  fp.is_completed,
  fp.completed_date,
  fp.updated_at
FROM follow_up_prospects fp
JOIN follow_up_prospects_cleanup_backup_20260605 b
  ON b.follow_up_id = fp.id
ORDER BY fp.id DESC;

UPDATE follow_up_prospects fp
SET
  is_active = b.old_is_active,
  is_completed = b.old_is_completed,
  completed_date = b.old_completed_date,
  updated_at = b.old_updated_at,
  notes = b.old_notes
FROM follow_up_prospects_cleanup_backup_20260605 b
WHERE fp.id = b.follow_up_id;

-- Despues del rollback.
SELECT
  'DESPUES_ROLLBACK' AS etapa,
  fp.id AS follow_up_id,
  fp.client_id,
  fp.is_active,
  fp.is_completed,
  fp.completed_date,
  fp.updated_at
FROM follow_up_prospects fp
JOIN follow_up_prospects_cleanup_backup_20260605 b
  ON b.follow_up_id = fp.id
ORDER BY fp.id DESC;

COMMIT;
