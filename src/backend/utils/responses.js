export const success = (res, data = null, message = 'Operación exitosa') => {
    res.status(200).json({
        success: true,
        message,
        data
    });
};

export const badRequest = (res, message = 'Solicitud incorrecta') => {
    res.status(400).json({
        success: false,
        message
    });
};

export const unauthorized = (res, message = 'No autorizado') => {
    res.status(401).json({
        success: false,
        message
    });
};

export const forbidden = (res, message = 'Prohibido') => {
    res.status(403).json({
        success: false,
        message
    });
};

export const notFound = (res, message = 'Recurso no encontrado') => {
    res.status(404).json({
        success: false,
        message
    });
};

export const serverError = (res, error, message = 'Error interno del servidor') => {
    console.error('Server Error:', error);
    res.status(500).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};