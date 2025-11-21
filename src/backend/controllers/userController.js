import bcrypt from 'bcrypt';
import { query } from '../database/db.js';
import { serverError, badRequest, notFound, conflict } from '../middlewares/errorHandler.js';

export const getUsers = async (req, res) => {
    try {
        const users = await query(
            `SELECT id, username, role, is_active, created_at, last_login 
       FROM users 
       ORDER BY created_at DESC`
        );
        res.json(users);
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
        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.length > 0) {
            return conflict(res, 'El usuario ya existe');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (username, password_hash, role, is_active) 
       VALUES ($1, $2, $3, 1) 
       RETURNING id, username, role, is_active, created_at`,
            [username, passwordHash, role]
        );

        res.status(201).json(result[0]);
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
