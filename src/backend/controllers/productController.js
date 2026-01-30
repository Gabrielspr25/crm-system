import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

export const getProducts = async (req, res) => {
    try {
        const products = await query(`
            SELECT p.*, c.name as category_name, c.color_hex as category_color 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.name ASC
        `);
        res.json(products); // query() ya devuelve rows directamente
    } catch (error) {
        serverError(res, error, 'Error obteniendo productos');
    }
};

export const createProduct = async (req, res) => {
    const {
        name, category_id, description, base_price,
        commission_percentage, is_recurring, billing_cycle,
        price, monthly_goal // Legacy fields support
    } = req.body;

    try {
        // Use either base_price or price (legacy support)
        const finalPrice = base_price !== undefined ? base_price : price;

        const result = await query(
            `INSERT INTO products (
                name, category_id, description, 
                base_price, commission_percentage, 
                is_recurring, billing_cycle,
                price, monthly_goal,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
            [
                name, category_id, description,
                finalPrice, commission_percentage,
                is_recurring ? 1 : 0, billing_cycle,
                finalPrice, monthly_goal || 0
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error creando producto');
    }
};

export const updateProduct = async (req, res) => {
    const { id } = req.params;
    const {
        name, category_id, description, base_price,
        commission_percentage, is_recurring, billing_cycle,
        price, monthly_goal
    } = req.body;

    try {
        const finalPrice = base_price !== undefined ? base_price : price;

        const result = await query(
            `UPDATE products SET 
                name = $1, category_id = $2, description = $3, 
                base_price = $4, commission_percentage = $5, 
                is_recurring = $6, billing_cycle = $7,
                price = $8, monthly_goal = $9,
                updated_at = NOW() 
            WHERE id = $10 RETURNING *`,
            [
                name, category_id, description,
                finalPrice, commission_percentage,
                is_recurring ? 1 : 0, billing_cycle,
                finalPrice, monthly_goal || 0,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando producto');
    }
};

export const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando producto');
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

export const getProductTiers = async (req, res) => {
    const { id } = req.params;
    try {
        const tiers = await query(
            `SELECT * FROM product_commission_tiers 
             WHERE product_id = $1 
             ORDER BY range_min ASC`,
            [id]
        );
        res.json(tiers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo tiers de comisión');
    }
};

export const getAllTiers = async (req, res) => {
    try {
        const tiers = await query(
            `SELECT t.*, p.name as product_name 
             FROM product_commission_tiers t
             LEFT JOIN products p ON t.product_id = p.id
             ORDER BY p.name, t.range_min ASC`
        );
        res.json(tiers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo todos los tiers');
    }
};

export const createTier = async (req, res) => {
    const { product_id, range_min, range_max, commission_amount } = req.body;
    try {
        const result = await query(
            `INSERT INTO product_commission_tiers (product_id, range_min, range_max, commission_amount, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
            [product_id, range_min, range_max, commission_amount]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error creando tier');
    }
};

export const updateTier = async (req, res) => {
    const { id } = req.params;
    const { range_min, range_max, commission_amount } = req.body;
    try {
        const result = await query(
            `UPDATE product_commission_tiers 
             SET range_min = $1, range_max = $2, commission_amount = $3, updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [range_min, range_max, commission_amount, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tier no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando tier');
    }
};

export const deleteTier = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM product_commission_tiers WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tier no encontrado' });
        }
        res.json({ message: 'Tier eliminado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando tier');
    }
};
