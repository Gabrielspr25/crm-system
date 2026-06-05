-- ============================================================================
-- VentasProui - Limpieza reversible de follow_up_prospects stale
-- Fecha: 2026-06-05
-- Objetivo:
--   Desactivar SOLO los 15 follow_up_prospects stale auditados.
--
-- No borra registros.
-- No toca clients.
-- No toca bans.
-- No toca SOV2.
--
-- Rollback:
--   scripts/migraciones/2026-06-05-rollback-followups-stale.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS follow_up_prospects_cleanup_backup_20260605 (
  follow_up_id BIGINT PRIMARY KEY,
  client_id UUID,
  old_is_active BOOLEAN,
  old_is_completed BOOLEAN,
  old_completed_date TIMESTAMPTZ,
  old_updated_at TIMESTAMPTZ,
  old_notes TEXT,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL
);

WITH target_ids(id) AS (
  VALUES
    (370), (369), (368), (367), (366),
    (365), (364), (363), (354), (352),
    (350), (349), (348), (347), (126)
)
INSERT INTO follow_up_prospects_cleanup_backup_20260605 (
  follow_up_id,
  client_id,
  old_is_active,
  old_is_completed,
  old_completed_date,
  old_updated_at,
  old_notes,
  reason
)
SELECT
  fp.id,
  fp.client_id,
  fp.is_active,
  fp.is_completed,
  fp.completed_date,
  fp.updated_at,
  fp.notes,
  'stale follow_up oculto: cliente sin BAN y/o sin datos comerciales'
FROM follow_up_prospects fp
JOIN target_ids t ON t.id = fp.id
ON CONFLICT (follow_up_id) DO NOTHING;

-- Antes: detalle de los 15 registros objetivo.
WITH target_ids(id) AS (
  VALUES
    (370), (369), (368), (367), (366),
    (365), (364), (363), (354), (352),
    (350), (349), (348), (347), (126)
)
SELECT
  'ANTES' AS etapa,
  fp.id AS follow_up_id,
  fp.client_id,
  fp.is_active,
  fp.is_completed,
  fp.completed_date,
  fp.updated_at,
  c.name AS client_name,
  c.business_name,
  COUNT(b.id)::int AS ban_count
FROM follow_up_prospects fp
JOIN target_ids t ON t.id = fp.id
LEFT JOIN clients c ON c.id = fp.client_id
LEFT JOIN bans b ON b.client_id = c.id
GROUP BY fp.id, c.id
ORDER BY fp.id DESC;

WITH target_ids(id) AS (
  VALUES
    (370), (369), (368), (367), (366),
    (365), (364), (363), (354), (352),
    (350), (349), (348), (347), (126)
)
UPDATE follow_up_prospects fp
SET
  is_active = false,
  updated_at = NOW()
FROM target_ids t
WHERE fp.id = t.id
  AND fp.completed_date IS NULL
  AND COALESCE(fp.is_active::text, 'true') IN ('true', '1', 't');

-- Despues: confirmar que los 15 ya no quedan activos.
WITH target_ids(id) AS (
  VALUES
    (370), (369), (368), (367), (366),
    (365), (364), (363), (354), (352),
    (350), (349), (348), (347), (126)
)
SELECT
  'DESPUES' AS etapa,
  fp.id AS follow_up_id,
  fp.client_id,
  fp.is_active,
  fp.is_completed,
  fp.completed_date,
  fp.updated_at
FROM follow_up_prospects fp
JOIN target_ids t ON t.id = fp.id
ORDER BY fp.id DESC;

-- Resumen esperado:
WITH target_ids(id) AS (
  VALUES
    (370), (369), (368), (367), (366),
    (365), (364), (363), (354), (352),
    (350), (349), (348), (347), (126)
)
SELECT
  COUNT(*)::int AS total_objetivo,
  COUNT(*) FILTER (
    WHERE fp.completed_date IS NULL
      AND COALESCE(fp.is_active::text, 'false') IN ('true', '1', 't')
  )::int AS activos_restantes
FROM follow_up_prospects fp
JOIN target_ids t ON t.id = fp.id;

COMMIT;
