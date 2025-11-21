import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

export const getVendors = async (req, res) => {
    try {
        const vendors = await query('SELECT * FROM vendors WHERE is_active = 1 ORDER BY name ASC');
        res.json(vendors);
    } catch (error) {
        serverError(res, error, 'Error obteniendo vendedores');
    }
};
