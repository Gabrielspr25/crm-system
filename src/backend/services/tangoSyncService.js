import { query } from '../database/db.js';

// Lock auto-release: si is_sync_running=true pero heartbeat_at no se actualizó
// en este tiempo, asumimos sync muerto y liberamos el lock automáticamente.
const HEARTBEAT_STALE_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Lee la configuración actual del sync (sync_from_date, last_successful_sync,
 * is_sync_running, heartbeat_at, etc.). Devuelve null si la tabla no existe.
 */
export async function getSyncConfig() {
    try {
        const rows = await query(
            `SELECT id,
                    sync_from_date::text     AS sync_from_date,
                    last_successful_sync,
                    last_sync_started_at,
                    last_sync_finished_at,
                    is_sync_running,
                    heartbeat_at,
                    current_sync_log_id::text AS current_sync_log_id,
                    updated_by::text          AS updated_by,
                    updated_at
               FROM tango_sync_config
              WHERE id = 1`
        );
        return rows[0] || null;
    } catch (err) {
        if (err?.code === '42P01') return null; // tabla aún no creada
        throw err;
    }
}

/**
 * Actualiza sync_from_date (única columna editable por el admin).
 * No toca campos de runtime (locks, fechas de sync).
 */
export async function updateSyncFromDate(syncFromDate, updatedBy) {
    if (!syncFromDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(syncFromDate))) {
        throw new Error('sync_from_date debe ser YYYY-MM-DD');
    }
    await query(
        `UPDATE tango_sync_config
            SET sync_from_date = $1::date,
                updated_by     = $2::uuid,
                updated_at     = NOW()
          WHERE id = 1`,
        [syncFromDate, updatedBy || null]
    );
    return getSyncConfig();
}

/**
 * Intenta adquirir el lock del sync. Si está libre, lo toma y devuelve
 * { acquired: true, autoReleased: bool }. Si está tomado pero el heartbeat
 * está stale (>30 min sin actualizar), libera el lock y lo toma (con warning
 * en logs). Si está tomado y vivo, devuelve { acquired: false, owner_log_id }.
 *
 * Pensado para ser idempotente: dos llamadas paralelas — solo una gana.
 */
export async function acquireSyncLock({ syncLogId }) {
    // Atomic try-acquire: UPDATE solo si está libre O stale.
    // current_sync_log_id es TEXT para soportar id INT (legacy) o UUID.
    const result = await query(
        `UPDATE tango_sync_config
            SET is_sync_running     = true,
                heartbeat_at        = NOW(),
                last_sync_started_at = NOW(),
                current_sync_log_id  = $1::text
          WHERE id = 1
            AND (
                  is_sync_running = false
               OR heartbeat_at IS NULL
               OR heartbeat_at < (NOW() - INTERVAL '${Math.round(HEARTBEAT_STALE_MS / 1000)} seconds')
            )
        RETURNING current_sync_log_id AS current_sync_log_id`,
        [String(syncLogId)]
    );

    if (result.length === 0) {
        // No se pudo adquirir: hay otro sync corriendo y vivo
        const current = await getSyncConfig();
        return {
            acquired: false,
            owner_log_id: current?.current_sync_log_id || null,
            heartbeat_at: current?.heartbeat_at || null,
        };
    }

    return { acquired: true, autoReleased: false };
}

/**
 * Detecta si había un lock stale al momento de adquirir (para log de warning).
 * Llamar antes de acquireSyncLock para snapshot.
 */
export async function detectStaleLock() {
    const cfg = await getSyncConfig();
    if (!cfg || !cfg.is_sync_running) return null;
    if (!cfg.heartbeat_at) return { reason: 'no_heartbeat', previous_log_id: cfg.current_sync_log_id };
    const ageMs = Date.now() - new Date(cfg.heartbeat_at).getTime();
    if (ageMs > HEARTBEAT_STALE_MS) {
        return {
            reason: 'heartbeat_stale',
            previous_log_id: cfg.current_sync_log_id,
            age_minutes: Math.round(ageMs / 60000),
        };
    }
    return null;
}

/**
 * Actualiza heartbeat. Llamar cada N filas dentro del sync para que
 * el lock no se considere muerto.
 */
export async function touchHeartbeat() {
    await query(
        `UPDATE tango_sync_config
            SET heartbeat_at = NOW()
          WHERE id = 1 AND is_sync_running = true`
    );
}

/**
 * Libera el lock al finalizar el sync (éxito o error). Actualiza
 * last_sync_finished_at y, si fue éxito, last_successful_sync.
 */
export async function releaseSyncLock({ success }) {
    await query(
        `UPDATE tango_sync_config
            SET is_sync_running       = false,
                last_sync_finished_at  = NOW(),
                last_successful_sync   = CASE WHEN $1 THEN NOW() ELSE last_successful_sync END,
                heartbeat_at           = NULL,
                current_sync_log_id    = NULL,
                updated_at             = NOW()
          WHERE id = 1`,
        [!!success]
    );
}

/**
 * Calcula el rango efectivo a leer en sync incremental:
 *   desde = max(sync_from_date, last_successful_sync::date)
 *   hasta = hoy
 * Si no hay last_successful_sync, usa sync_from_date.
 */
export async function computeIncrementalRange() {
    const cfg = await getSyncConfig();
    if (!cfg) {
        throw new Error('tango_sync_config no existe — falta ejecutar migración');
    }
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const fromDate = cfg.sync_from_date;
    const lastSyncISO = cfg.last_successful_sync
        ? new Date(cfg.last_successful_sync).toISOString().slice(0, 10)
        : null;

    const effectiveFrom = lastSyncISO && lastSyncISO > fromDate ? lastSyncISO : fromDate;

    return {
        from: effectiveFrom,
        to: todayISO,
        sync_mode: 'incremental',
    };
}

/**
 * Crea fila inicial en sync_logs para el sync que está por arrancar.
 * Devuelve { id, started_at } para que el caller use ese id en heartbeat
 * y para actualizar al finalizar.
 */
export async function createSyncLog({ syncMode, rangeStart, rangeEnd, reason, userId, userRole }) {
    // id en sync_logs puede ser INTEGER (legacy) o UUID. RETURNING id::text
    // funciona con ambos.
    const rows = await query(
        `INSERT INTO sync_logs (
            sync_type, status, sync_mode,
            range_start_date, range_end_date, reason,
            created_by, details, started_at
         )
         VALUES (
            'tango_pymes', 'running', $1,
            $2::date, $3::date, $4,
            $5::uuid,
            jsonb_build_object('user_role', $6, 'started_at', NOW()),
            NOW()
         )
         RETURNING id::text AS id, started_at`,
        [syncMode, rangeStart || null, rangeEnd || null, reason || null, userId || null, userRole || null]
    );
    return rows[0];
}

/**
 * Cierra fila en sync_logs con métricas estructuradas.
 * id en sync_logs puede ser INTEGER o UUID; usamos id::text = $1 para ambos.
 */
export async function closeSyncLog({ id, status, stats, warnings, durationMs }) {
    if (!id) return;
    await query(
        `UPDATE sync_logs
            SET status        = $2,
                stats         = $3::jsonb,
                warnings      = $4::jsonb,
                rows_new      = ($3::jsonb ->> 'rows_new')::int,
                rows_updated  = ($3::jsonb ->> 'rows_updated')::int,
                rows_ignored  = ($3::jsonb ->> 'rows_ignored')::int,
                errors_count  = ($3::jsonb ->> 'errors_count')::int,
                duration_ms   = $5,
                finished_at   = NOW(),
                updated_at    = NOW()
          WHERE id::text = $1::text`,
        [String(id), status, JSON.stringify(stats || {}), JSON.stringify(warnings || []), durationMs || null]
    );
}

/**
 * Lista los últimos N syncs.
 */
export async function listSyncLogs({ limit = 20 } = {}) {
    const rows = await query(
        `SELECT id::text                          AS id,
                sync_mode,
                status,
                range_start_date::text            AS range_start_date,
                range_end_date::text              AS range_end_date,
                reason,
                rows_new, rows_updated, rows_ignored, errors_count,
                duration_ms,
                created_by::text                  AS created_by,
                started_at, finished_at,
                warnings
           FROM sync_logs
          WHERE sync_type = 'tango_pymes'
          ORDER BY started_at DESC NULLS LAST
          LIMIT $1`,
        [Math.min(100, Math.max(1, Number(limit) || 20))]
    );
    return rows;
}
