import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Middleware para verificar el token JWT
 */
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
};

/**
 * Middleware para verificar roles
 * @param {string[]} allowedRoles - Array de roles permitidos
 */
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
        }
        next();
    };
};
