-- =====================================================================
-- Migración: Tango Sync Controlado (Fase 2A)
-- Fecha: 2026-05-17
-- =====================================================================
-- Objetivo:
--   1. Persistir configuración global del sync Tango (rangos, locks)
--   2. Permitir sync incremental sin releer histórico completo
--   3. Permitir resync por rango controlado (manual)
--   4. Trackear métricas estructuradas en sync_logs
--
-- IMPORTANTE — schema legacy de sync_logs:
--   La tabla sync_logs en producción es legacy: id INTEGER, sync_date,
--   total_tango, etc. El código nuevo asume columnas adicionales
--   (started_at, status, stats, created_by, finished_at, updated_at,
--   sync_mode, etc.). Esta migración agrega TODAS con ADD COLUMN IF
--   NOT EXISTS — no toca columnas legacy ni datos existentes.
--
-- Reglas:
--   - incremental = solo lectura/actualización segura, sin cleanup
--   - resync_range = puede ejecutar cleanup, requiere reason
--   - Tango siempre conserva valor original
--   - Overrides gerenciales (Fase 3) viven en tabla aparte
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1) Configuración global del sync (1 sola fila, id=1)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tango_sync_config (
    id                       SMALLINT PRIMARY KEY DEFAULT 1,
    sync_from_date           DATE         NOT NULL,
    last_successful_sync     TIMESTAMP    NULL,
    last_sync_started_at     TIMESTAMP    NULL,
    last_sync_finished_at    TIMESTAMP    NULL,
    is_sync_running          BOOLEAN      NOT NULL DEFAULT false,
    heartbeat_at             TIMESTAMP    NULL,
    current_sync_log_id      TEXT         NULL,   -- TEXT para soportar id INT o UUID
    updated_by               UUID         NULL,
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT tango_sync_config_singleton CHECK (id = 1)
);

INSERT INTO tango_sync_config (id, sync_from_date)
VALUES (1, '2026-01-01'::date)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2) Extender sync_logs con columnas que el código nuevo necesita
--    (todas opcionales, sin tocar columnas legacy)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE sync_logs
    -- Columnas que el helper antiguo ya intentaba usar (legacy no las tenía)
    ADD COLUMN IF NOT EXISTS status           TEXT       NULL,
    ADD COLUMN IF NOT EXISTS stats            JSONB      NULL,
    ADD COLUMN IF NOT EXISTS created_by       UUID       NULL,
    ADD COLUMN IF NOT EXISTS started_at       TIMESTAMP  NULL,
    ADD COLUMN IF NOT EXISTS finished_at      TIMESTAMP  NULL,
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP  NULL,
    -- Columnas nuevas Fase 2A para sync controlado por rango
    ADD COLUMN IF NOT EXISTS sync_mode        TEXT       NULL,
    ADD COLUMN IF NOT EXISTS range_start_date DATE       NULL,
    ADD COLUMN IF NOT EXISTS range_end_date   DATE       NULL,
    ADD COLUMN IF NOT EXISTS reason           TEXT       NULL,
    ADD COLUMN IF NOT EXISTS rows_new         INTEGER    NULL,
    ADD COLUMN IF NOT EXISTS rows_updated     INTEGER    NULL,
    ADD COLUMN IF NOT EXISTS rows_ignored     INTEGER    NULL,
    ADD COLUMN IF NOT EXISTS errors_count     INTEGER    NULL,
    ADD COLUMN IF NOT EXISTS duration_ms      INTEGER    NULL,
    ADD COLUMN IF NOT EXISTS warnings         JSONB      NULL;

-- Índice solo si la columna existe (siempre cierto después del ALTER)
CREATE INDEX IF NOT EXISTS sync_logs_mode_started_idx
    ON sync_logs (sync_mode, started_at DESC);
