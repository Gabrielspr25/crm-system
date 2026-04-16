import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../database/db.js';

const normalizeRole = (value, fallbackSalespersonId = null) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized) return normalized;
    return fallbackSalespersonId ? 'vendedor' : 'admin';
};

const hydrateAuthenticatedUser = async (tokenUser) => {
    const userId = tokenUser?.userId ?? null;
    const username = String(tokenUser?.username || '').trim();

    if (!userId && !username) {
        return tokenUser;
    }

    const rows = await query(
        `SELECT u.id,
                u.username,
                u.salesperson_id,
                s.name AS salesperson_name,
                s.role AS salesperson_role
         FROM users_auth u
         LEFT JOIN salespeople s ON s.id = u.salesperson_id
         WHERE ($1::int IS NOT NULL AND u.id = $1)
            OR ($2::text <> '' AND u.username = $2)
         ORDER BY CASE WHEN ($1::int IS NOT NULL AND u.id = $1) THEN 0 ELSE 1 END
         LIMIT 1`,
        [userId ? Number(userId) : null, username]
    );

    if (rows.length === 0) {
        return tokenUser;
    }

    const row = rows[0];

    return {
        ...tokenUser,
        userId: row.id,
        username: row.username,
        role: normalizeRole(row.salesperson_role, row.salesperson_id),
        salespersonId: row.salesperson_id || null,
        salespersonName: row.salesperson_name || null,
    };
};

/**
 * Middleware para verificar el token JWT
 */
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    try {
        const decodedUser = jwt.verify(token, config.jwtSecret, { ignoreExpiration: true });

        try {
            req.user = await hydrateAuthenticatedUser(decodedUser);
        } catch (dbError) {
            console.error('No se pudo hidratar usuario autenticado desde BD:', dbError);
            req.user = decodedUser;
        }

        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};

/**
 * Middleware para verificar roles
 * @param {string[]} allowedRoles - Array de roles permitidos
 */
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const currentRole = String(req.user?.role || '').trim().toLowerCase();
        const normalizedAllowedRoles = allowedRoles.map((role) => String(role || '').trim().toLowerCase());

        if (!req.user || !normalizedAllowedRoles.includes(currentRole)) {
            return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
        }

        next();
    };
};
