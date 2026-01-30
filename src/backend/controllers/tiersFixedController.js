import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

export const getTiersByProduct = async (req, res) => {
    const { productId } = req.params;
    try {
        const tiers = await query(
            'SELECT * FROM commission_tiers_fijo WHERE product_id = $1 ORDER BY contract_duration DESC',
            [productId]
        );
        res.json(tiers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo tiers fijo');
    }
};

export const createTierFixed = async (req, res) => {
    const { product_id, contract_duration, multiplier } = req.body;
    try {
        const result = await query(
            'INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier) VALUES ($1, $2, $3) RETURNING *',
            [product_id, contract_duration, multiplier]
        );
        res.status(201).json(result[0]);
    } catch (error) {
        if (error.code === '23505') { // unique violation
            return res.status(400).json({ error: 'Ya existe un tier para esta duración de contrato' });
        }
        serverError(res, error, 'Error creando tier fijo');
    }
};

export const updateTierFixed = async (req, res) => {
    const { id } = req.params;
    const { contract_duration, multiplier } = req.body;
    try {
        const result = await query(
            'UPDATE commission_tiers_fijo SET contract_duration = $1, multiplier = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [contract_duration, multiplier, id]
        );
        if (result.length === 0) {
            return res.status(404).json({ error: 'Tier no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando tier fijo');
    }
};

export const deleteTierFixed = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM commission_tiers_fijo WHERE id = $1 RETURNING id', [id]);
        if (result.length === 0) {
            return res.status(404).json({ error: 'Tier no encontrado' });
        }
        res.json({ message: 'Tier eliminado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando tier fijo');
    }
};
