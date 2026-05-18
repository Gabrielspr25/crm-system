import {
    getSyncConfig,
    updateSyncFromDate,
    listSyncLogs,
} from '../services/tangoSyncService.js';

// =====================================================================
// /api/tango-sync — Config + logs (lectura/escritura admin)
// =====================================================================
// Estos endpoints NO disparan el sync. Eso vive en /api/tango/sync
// (POST run incremental) y /api/tango/sync-range (POST resync por rango)
// — ver tangoRoutes.js refactorizado.
// =====================================================================

function requireAdmin(req, res) {
    const role = String(req.user?.role || '').trim().toLowerCase();
    if (role !== 'admin' && role !== 'supervisor') {
        res.status(403).json({ error: 'Solo admin/supervisor' });
        return false;
    }
    return true;
}

export const getConfig = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const cfg = await getSyncConfig();
        if (!cfg) {
            return res.status(503).json({
                error: 'tango_sync_config no inicializado. Ejecutar migración 2026-05-17-tango-sync-config.sql',
            });
        }
        return res.json(cfg);
    } catch (err) {
        console.error('[tangoSync.getConfig] error:', err);
        return res.status(500).json({ error: 'Error obteniendo configuración' });
    }
};

export const patchConfig = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const { sync_from_date } = req.body || {};
        if (!sync_from_date) {
            return res.status(400).json({ error: 'sync_from_date requerido (formato YYYY-MM-DD)' });
        }
        const updated = await updateSyncFromDate(sync_from_date, req.user?.id || null);
        return res.json(updated);
    } catch (err) {
        console.error('[tangoSync.patchConfig] error:', err);
        return res.status(500).json({ error: err.message || 'Error actualizando configuración' });
    }
};

export const getLogs = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const limit = Number(req.query?.limit) || 20;
        const logs = await listSyncLogs({ limit });
        return res.json(logs);
    } catch (err) {
        console.error('[tangoSync.getLogs] error:', err);
        return res.status(500).json({ error: 'Error obteniendo logs' });
    }
};
