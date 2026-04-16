import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';
import bcrypt from 'bcrypt';

const normalizeRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return ['admin', 'supervisor', 'vendedor'].includes(normalized) ? normalized : 'vendedor';
};

const hasVendorSalespersonMappingTable = async () => {
    try {
        const rows = await query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'vendor_salesperson_mapping'
            ) AS exists
        `);
        return Boolean(rows[0]?.exists);
    } catch {
        return false;
    }
};

export const getVendors = async (_req, res) => {
    try {
        const hasMappingTable = await hasVendorSalespersonMappingTable();
        let vendors = [];
        if (hasMappingTable) {
            vendors = await query(`
                SELECT
                    v.*,
                    COALESCE(vsm.salesperson_id, sp_fallback.id) AS salesperson_id,
                    COALESCE(sp_map.name, sp_fallback.name) AS salesperson_name,
                    COALESCE(sp_map.role, sp_fallback.role) AS salesperson_role
                FROM vendors v
                LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
                LEFT JOIN salespeople sp_map ON sp_map.id = vsm.salesperson_id
                LEFT JOIN salespeople sp_fallback
                  ON sp_map.id IS NULL
                 AND UPPER(TRIM(sp_fallback.name)) = UPPER(TRIM(v.name))
                WHERE v.is_active = 1
                ORDER BY COALESCE(sp_map.name, sp_fallback.name, v.name) ASC
            `);
        } else {
            vendors = await query(`
                SELECT
                    v.*,
                    sp.id AS salesperson_id,
                    sp.name AS salesperson_name,
                    sp.role AS salesperson_role
                FROM vendors v
                LEFT JOIN salespeople sp
                  ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
                WHERE v.is_active = 1
                ORDER BY COALESCE(sp.name, v.name) ASC
            `);
        }

        res.json(vendors);
    } catch (error) {
        serverError(res, error, 'Error obteniendo vendedores');
    }
};

export const createVendor = async (req, res) => {
    const { name, email, role, username, password, commission_percentage } = req.body || {};
    const normalizedRole = normalizeRole(role);

    console.log('CREATE VENDOR - Datos recibidos:', {
        name,
        email,
        role: normalizedRole,
        username,
        hasPassword: !!password,
        commission_percentage
    });

    try {
        const salespersonResult = await query(
            `INSERT INTO salespeople (name, email, role, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING id`,
            [name, email || null, normalizedRole]
        );
        const salespersonId = salespersonResult[0].id;

        if (username && password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await query(
                `INSERT INTO users_auth (username, password, salesperson_id, created_at)
                 VALUES ($1, $2, $3, NOW())`,
                [String(username).toLowerCase(), hashedPassword, salespersonId]
            );
        }

        const vendorResult = await query(
            `INSERT INTO vendors (name, email, commission_percentage, is_active, created_at)
             VALUES ($1, $2, $3, 1, NOW())
             RETURNING *`,
            [name, email || null, commission_percentage || 50.00]
        );

        if (await hasVendorSalespersonMappingTable()) {
            await query(
                `INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id)
                 VALUES ($1, $2)
                 ON CONFLICT (vendor_id) DO UPDATE SET salesperson_id = EXCLUDED.salesperson_id`,
                [vendorResult[0].id, salespersonId]
            );
        }

        res.status(201).json({
            vendor: vendorResult[0],
            salesperson_id: salespersonId,
            salesperson_role: normalizedRole,
            has_login: !!username,
        });
    } catch (error) {
        if (error.code === '23505' && error.constraint === 'users_auth_username_key') {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        serverError(res, error, 'Error creando vendedor');
    }
};

export const updateVendor = async (req, res) => {
    const { id } = req.params;
    const { name, email, commission_percentage, role, salesperson_id } = req.body || {};
    const normalizedRole = normalizeRole(role);

    try {
        const existingVendorRows = await query(
            'SELECT * FROM vendors WHERE id = $1 AND is_active = 1',
            [id]
        );
        if (existingVendorRows.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }

        const updatedVendorRows = await query(
            `UPDATE vendors
             SET name = $1, email = $2, commission_percentage = $3
             WHERE id = $4 AND is_active = 1
             RETURNING *`,
            [name, email || null, commission_percentage || 50.00, id]
        );
        if (updatedVendorRows.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }

        const existingVendor = existingVendorRows[0];
        let updatedSalespeopleRows = [];

        if (salesperson_id) {
            updatedSalespeopleRows = await query(
                `UPDATE salespeople
                 SET name = $1, email = $2, role = $3, updated_at = NOW()
                 WHERE id = $4
                 RETURNING id, role`,
                [name, email || null, normalizedRole, salesperson_id]
            );
        }

        if (updatedSalespeopleRows.length === 0) {
            updatedSalespeopleRows = await query(
                `UPDATE salespeople
                 SET name = $1, email = $2, role = $3, updated_at = NOW()
                 WHERE UPPER(TRIM(name)) = UPPER(TRIM($4))
                 RETURNING id, role`,
                [name, email || null, normalizedRole, existingVendor.name]
            );
        }

        if (updatedSalespeopleRows.length > 0 && await hasVendorSalespersonMappingTable()) {
            await query(
                `INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id)
                 VALUES ($1, $2)
                 ON CONFLICT (vendor_id) DO UPDATE SET salesperson_id = EXCLUDED.salesperson_id`,
                [id, updatedSalespeopleRows[0].id]
            );
        }

        res.json({
            ...updatedVendorRows[0],
            salesperson_id: updatedSalespeopleRows[0]?.id || salesperson_id || null,
            salesperson_role: updatedSalespeopleRows[0]?.role || normalizedRole
        });
    } catch (error) {
        serverError(res, error, 'Error actualizando vendedor');
    }
};

export const deleteVendor = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query(
            'UPDATE vendors SET is_active = 0 WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.length === 0) {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }
        res.json({ message: 'Vendedor desactivado correctamente' });
    } catch (error) {
        serverError(res, error, 'Error eliminando vendedor');
    }
};
