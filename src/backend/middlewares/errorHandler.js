/**
 * Middleware global de manejo de errores
 */
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Error no capturado:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(statusCode).json({
        error: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

// Helpers para respuestas comunes
export const serverError = (res, error, message = 'Error interno del servidor') => {
    console.error(`❌ ${message}:`, error);
    res.status(500).json({ error: message });
};

export const badRequest = (res, message) => {
    res.status(400).json({ error: message });
};

export const notFound = (res, entity = 'Recurso') => {
    res.status(404).json({ error: `${entity} no encontrado` });
};

export const conflict = (res, message) => {
    res.status(409).json({ error: message });
};
