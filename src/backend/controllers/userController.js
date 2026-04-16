import bcrypt from 'bcrypt';
import { query } from '../database/db.js';
import { serverError, badRequest, notFound, conflict } from '../middlewares/errorHandler.js';
import { ensurePermissionSchema } from '../utils/permissionService.js';

export const getUsers = async (req, res) => {
    try {
        await ensurePermissionSchema(query);
        const users = await query(
            `SELECT
                u.id::text AS id,
                u.username,
                u.salesperson_id::text AS salesperson_id,
                s.name AS salesperson_name,
                s.role AS salesperson_role,
                u.created_at,
                u.last_login,
                (
                    SELECT COUNT(*)
                    FROM user_permission_overrides upo
                    WHERE upo.user_id::text = u.id::text
                      AND upo.effect <> 'inherit'
                )::int AS permission_overrides_count
             FROM users_auth u
             LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
             ORDER BY u.created_at DESC`
        );

        const mappedUsers = users.map(u => ({
            ...u,
            role: String(u.salesperson_role || '').trim().toLowerCase() || (u.salesperson_id ? 'vendedor' : 'admin'),
            is_active: 1 // Fake active
        }));
        res.json(mappedUsers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo usuarios');
    }
};

export const createUser = async (req, res) => {
    const { username, password, role = 'vendedor' } = req.body;

    if (!username || !password) {
        return badRequest(res, 'Usuario y contraseña requeridos');
    }

    try {
        const existing = await query('SELECT id FROM users_auth WHERE username = $1', [username]);
        if (existing.length > 0) {
            return conflict(res, 'El usuario ya existe');
        }

        let finalSalespersonId = req.body.salesperson_id;

        // Si no se proporciona salesperson_id, crear un vendedor automáticamente
        if (!finalSalespersonId) {
            const newSalesperson = await query(
                `INSERT INTO salespeople (name, email, role, created_at, updated_at)
                 VALUES ($1, $2, 'vendedor', NOW(), NOW())
                 RETURNING id`,
                [username, `${username}@generated.com`]
            );
            finalSalespersonId = newSalesperson[0].id;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users_auth (username, password, salesperson_id, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING id, username, created_at`,
            [username, passwordHash, finalSalespersonId]
        );
        
        const newUser = result[0];
        newUser.role = 'admin'; // Default to admin if created this way
        newUser.is_active = 1;

        res.status(201).json(newUser);
    } catch (error) {
        serverError(res, error, 'Error creando usuario');
    }
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { password, role, is_active } = req.body;

    try {
        // Verificar si existe
        const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Usuario');
        }

        let queryStr = 'UPDATE users SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (password) {
            const hash = await bcrypt.hash(password, 10);
            queryStr += `, password_hash = $${paramCount}`;
            params.push(hash);
            paramCount++;
        }

        if (role) {
            queryStr += `, role = $${paramCount}`;
            params.push(role);
            paramCount++;
        }

        if (is_active !== undefined) {
            queryStr += `, is_active = $${paramCount}`;
            params.push(is_active ? 1 : 0);
            paramCount++;
        }

        queryStr += ` WHERE id = $${paramCount} RETURNING id, username, role, is_active`;
        params.push(id);

        const result = await query(queryStr, params);
        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando usuario');
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.length === 0) {
            return notFound(res, 'Usuario');
        }
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando usuario');
    }
};
