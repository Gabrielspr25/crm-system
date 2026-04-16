import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { config } from '../config/env.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';

const signPersistentToken = (payload) => jwt.sign(payload, config.jwtSecret);

export const getMe = async (req, res) => {
    res.json({ user: req.user });
};

export const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return badRequest(res, 'Usuario y contraseña requeridos');
    }

    try {
        const users = await query(
            `SELECT u.*, s.role AS salesperson_role
             FROM users_auth u
             LEFT JOIN salespeople s ON s.id = u.salesperson_id
             WHERE u.username = $1`,
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        let salespersonId = user.salesperson_id;
        const normalizedRole = String(user.salesperson_role || '').trim().toLowerCase();
        const role = normalizedRole || (salespersonId ? 'vendedor' : 'admin');

        const tokenPayload = {
            userId: user.id,
            username: user.username,
            role: role,
            salespersonId: salespersonId
        };

        const token = signPersistentToken(tokenPayload);

        // Registrar último login
        await query('UPDATE users_auth SET last_login = NOW() WHERE id = $1', [user.id]);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: role,
                salespersonId: salespersonId
            }
        });
    } catch (error) {
        serverError(res, error, 'Error en login');
    }
};

export const refreshToken = async (req, res) => {
    // Implementación simple de refresh (en este caso solo verificamos el token actual y damos uno nuevo si es válido)
    // En un sistema más robusto usaríamos refresh tokens dedicados en DB
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) return res.sendStatus(403);

        const newToken = signPersistentToken({
            userId: user.userId,
            username: user.username,
            role: user.role,
            salespersonId: user.salespersonId
        });

        res.json({ token: newToken });
    });
};

export const devAdminLogin = async (req, res) => {
    try {
        const tokenPayload = {
            userId: 9999,
            username: 'admin_dev',
            role: 'admin',
            salespersonId: null
        };

        const token = signPersistentToken(tokenPayload);

        res.json({
            token,
            user: {
                id: 9999,
                username: 'admin_dev',
                role: 'admin',
                salespersonId: null
            }
        });
    } catch (error) {
        serverError(res, error, 'Error en dev login');
    }
};
