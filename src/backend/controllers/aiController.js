import { serverError } from '../middlewares/errorHandler.js';

export const chatWithAI = async (req, res) => {
    try {
        // TODO: Migrar lógica de integración con Gemini/OpenAI
        res.json({ response: 'La funcionalidad de chat AI está en mantenimiento durante la refactorización.' });
    } catch (error) {
        serverError(res, error, 'Error en chat AI');
    }
};
