import { query } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';
import {
    getPermissionCatalogResponse,
    resolvePermissionsForUser,
    saveUserPermissionOverrides
} from '../utils/permissionService.js';

export const getPermissionCatalog = async (_req, res) => {
    try {
        res.json(getPermissionCatalogResponse());
    } catch (error) {
        serverError(res, error, 'Error obteniendo catalogo de permisos');
    }
};

export const getCurrentUserPermissions = async (req, res) => {
    try {
        const resolved = await resolvePermissionsForUser(query, req.user);
        res.json(resolved);
    } catch (error) {
        serverError(res, error, 'Error obteniendo permisos del usuario actual');
    }
};

export const getUserPermissions = async (req, res) => {
    const userId = String(req.params?.id || '').trim();
    if (!userId) {
        return badRequest(res, 'id es requerido');
    }

    try {
        const rows = await query(
            `SELECT u.id::text AS id,
                    u.username,
                    u.salesperson_id::text AS salesperson_id,
                    s.name AS salesperson_name,
                    s.role AS salesperson_role
               FROM users_auth u
               LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
              WHERE u.id::text = $1
              LIMIT 1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const row = rows[0];
        const role = String(row.salesperson_role || '').trim().toLowerCase() || (row.salesperson_id ? 'vendedor' : 'admin');
        const resolved = await resolvePermissionsForUser(query, {
            userId: row.id,
            username: row.username,
            salespersonId: row.salesperson_id,
            salespersonName: row.salesperson_name || null,
            role
        });

        res.json({
            user: {
                userId: row.id,
                username: row.username,
                salespersonId: row.salesperson_id,
                salespersonName: row.salesperson_name || null,
                role
            },
            ...resolved
        });
    } catch (error) {
        serverError(res, error, 'Error obteniendo permisos del usuario');
    }
};

export const updateUserPermissions = async (req, res) => {
    const userId = String(req.params?.id || '').trim();
    const items = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

    if (!userId) {
        return badRequest(res, 'id es requerido');
    }

    try {
        const existing = await query(
            `SELECT u.id::text AS id,
                    u.username,
                    u.salesperson_id::text AS salesperson_id,
                    s.name AS salesperson_name,
                    s.role AS salesperson_role
               FROM users_auth u
               LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
              WHERE u.id::text = $1
              LIMIT 1`,
            [userId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const row = existing[0];
        const role = String(row.salesperson_role || '').trim().toLowerCase() || (row.salesperson_id ? 'vendedor' : 'admin');
        const overrides = await saveUserPermissionOverrides(query, req.user?.userId, userId, items);
        const resolved = await resolvePermissionsForUser(query, {
            userId,
            username: row.username,
            salespersonId: row.salesperson_id,
            salespersonName: row.salesperson_name || null,
            role
        });

        res.json({
            user_id: userId,
            overrides,
            permissions: resolved.permissions
        });
    } catch (error) {
        serverError(res, error, 'Error guardando permisos del usuario');
    }
};
