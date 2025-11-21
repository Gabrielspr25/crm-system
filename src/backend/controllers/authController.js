import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { config } from '../config/env.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';

export const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return badRequest(res, 'Usuario y contraseña requeridos');
    }

    try {
        const users = await query('SELECT * FROM users WHERE username = $1', [username]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Obtener salesperson_id si es vendedor
        let salespersonId = null;
        if (user.role === 'vendedor') {
            const salesPeople = await query('SELECT id FROM salespeople WHERE user_id = $1', [user.id]);
            if (salesPeople.length > 0) {
                salespersonId = salesPeople[0].id;
            }
        }

        const tokenPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            salespersonId: salespersonId
        };

        const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '8h' });

        // Registrar último login
        await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
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

        const newToken = jwt.sign(
            {
                userId: user.userId,
                username: user.username,
                role: user.role,
                salespersonId: user.salespersonId
            },
            config.jwtSecret,
            { expiresIn: '8h' }
        );

        res.json({ token: newToken });
    });
};
