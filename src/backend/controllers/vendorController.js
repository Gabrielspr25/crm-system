import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';
import bcrypt from 'bcrypt';

export const getVendors = async (req, res) => {
    try {
        // REVERTIDO: Usar vendors (tiene datos históricos de sales_reports y follow_up_prospects)
        const vendors = await query('SELECT * FROM vendors WHERE is_active = 1 ORDER BY name ASC');
        res.json(vendors);
    } catch (error) {
        serverError(res, error, 'Error obteniendo vendedores');
    }
};

export const createVendor = async (req, res) => {
    const { name, email, role, username, password, commission_percentage } = req.body;

    console.log('📝 CREATE VENDOR - Datos recibidos:', { name, email, role, username, hasPassword: !!password, commission_percentage });

    try {
        // 1. Crear en salespeople (tabla nueva con UUID y role)
        console.log('📝 Insertando en salespeople con:', [name, email || null, role || 'vendedor']);
        const salespersonResult = await query(
            'INSERT INTO salespeople (name, email, role, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
            [name, email || null, role || 'vendedor']
        );
        console.log('✅ Salesperson creado, resultado:', salespersonResult.rows);
        const salespersonId = salespersonResult.rows[0].id;

        // 2. Crear usuario de login en users_auth (si se proporcionó username/password)
        if (username && password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await query(
                'INSERT INTO users_auth (username, password, salesperson_id, created_at) VALUES ($1, $2, $3, NOW())',
                [username.toLowerCase(), hashedPassword, salespersonId]
            );
        }

        // 3. Crear en vendors (tabla legacy para compatibilidad con sales_reports)
        const vendorResult = await query(
            'INSERT INTO vendors (name, email, commission_percentage, is_active, created_at) VALUES ($1, $2, $3, 1, NOW()) RETURNING *',
            [name, email || null, commission_percentage || 50.00]
        );

        res.status(201).json({
            vendor: vendorResult.rows[0],
            salesperson_id: salespersonId,
            has_login: !!username,
        });
    } catch (error) {
        // Si username ya existe, dar error específico
        if (error.code === '23505' && error.constraint === 'users_auth_username_key') {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        serverError(res, error, 'Error creando vendedor');
    }
};

export const updateVendor = async (req, res) => {
    const { id } = req.params;
    const { name, email, commission_percentage } = req.body;
    try {
        const result = await query(
            'UPDATE vendors SET name = $1, email = $2, commission_percentage = $3 WHERE id = $4 AND is_active = 1 RETURNING *',
            [name, email || null, commission_percentage || 50.00, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando vendedor');
    }
};

export const deleteVendor = async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete en vendors
        const result = await query('UPDATE vendors SET is_active = 0 WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }
        res.json({ message: 'Vendedor desactivado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando vendedor');
    }
};
