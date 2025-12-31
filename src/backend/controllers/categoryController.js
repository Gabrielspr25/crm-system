
import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

export const getCategories = async (req, res) => {
    try {
        const categories = await query('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories.rows);
    } catch (error) {
        serverError(res, error, 'Error obteniendo categorías');
    }
};

export const createCategory = async (req, res) => {
    const { name, description, color_hex } = req.body;
    try {
        // Try insert with color_hex. If column missing, this will fail.
        // Assuming database has these columns or we need to add them. 
        // Based on Categories.tsx, these are required.
        const result = await query(
            'INSERT INTO categories (name, description, color_hex, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
            [name, description, color_hex]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error creando categoría');
    }
};

export const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description, color_hex } = req.body;
    try {
        const result = await query(
            'UPDATE categories SET name = $1, description = $2, color_hex = $3 WHERE id = $4 RETURNING *',
            [name, description, color_hex, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando categoría');
    }
};

export const deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json({ message: 'Categoría eliminada correctamente' });
    } catch (error) {
        // Handle FK violations if products exist
        serverError(res, error, 'Error eliminando categoría');
    }
};
