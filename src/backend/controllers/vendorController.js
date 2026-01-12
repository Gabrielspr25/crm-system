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

export const createVendor = async (req, res) => {
    const { name, email, salesperson_id } = req.body;
    try {
        // 1. Crear vendor
        const result = await query(
            'INSERT INTO vendors (name, email, is_active, created_at, updated_at) VALUES ($1, $2, 1, NOW(), NOW()) RETURNING *',
            [name, email]
        );
        
        const newVendor = result.rows[0];
        
        // 2. Si se proporciona salesperson_id, crear mapeo automáticamente
        if (salesperson_id) {
            await query(
                'INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [newVendor.id, salesperson_id]
            );
        }
        
        res.status(201).json(newVendor);
    } catch (error) {
        serverError(res, error, 'Error creando vendedor');
    }
};

export const updateVendor = async (req, res) => {
    const { id } = req.params;
    const { name, email, salesperson_id } = req.body;
    try {
        // 1. Actualizar vendor
        const result = await query(
            'UPDATE vendors SET name = $1, email = $2, updated_at = NOW() WHERE id = $3 AND is_active = 1 RETURNING *',
            [name, email, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }
        
        // 2. Si se proporciona salesperson_id, actualizar/crear mapeo
        if (salesperson_id) {
            await query(
                'INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id) VALUES ($1, $2) ON CONFLICT (vendor_id, salesperson_id) DO NOTHING',
                [id, salesperson_id]
            );
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando vendedor');
    }
};

export const deleteVendor = async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete
        const result = await query(
            'UPDATE vendors SET is_active = 0, updated_at = NOW() WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }
        res.json({ message: 'Vendedor eliminado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando vendedor');
    }
};
