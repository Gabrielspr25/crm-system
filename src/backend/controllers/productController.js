import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

export const getProducts = async (req, res) => {
    try {
        const products = await query('SELECT * FROM products ORDER BY name ASC');
        res.json(products);
    } catch (error) {
        serverError(res, error, 'Error obteniendo productos');
    }
};

export const getBusinessGoals = async (req, res) => {
    try {
        const goals = await query(
            `SELECT bg.*, p.name as product_name
       FROM business_goals bg
       LEFT JOIN products p ON bg.product_id = p.id
       ORDER BY bg.year DESC, bg.month DESC`
        );
        res.json(goals);
    } catch (error) {
        serverError(res, error, 'Error obteniendo metas de negocio');
    }
};

export const getVendorGoals = async (req, res) => {
    try {
        const goals = await query(
            `SELECT pg.*, p.name AS product_name, v.name AS vendor_name
       FROM product_goals pg
       LEFT JOIN products p ON pg.product_id = p.id
       LEFT JOIN vendors v ON pg.vendor_id = v.id
       ORDER BY pg.year DESC, pg.month DESC`
        );
        res.json(goals);
    } catch (error) {
        serverError(res, error, 'Error obteniendo metas de vendedores');
    }
};
