import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

export const getBans = async (req, res) => {
    const { client_id } = req.query;
    try {
        let sql = 'SELECT * FROM bans';
        const params = [];
        if (client_id) {
            sql += ' WHERE client_id = $1';
            params.push(client_id);
        }
        sql += ' ORDER BY created_at DESC';

        const bans = await query(sql, params);
        res.json(bans);
    } catch (error) {
        serverError(res, error, 'Error obteniendo BANs');
    }
};

export const createBan = async (req, res) => {
    const {
        client_id,
        account_number,
        address = null,
        city = null,
        zip_code = null,
        vendor_id = null
    } = req.body;

    if (!client_id || !account_number) {
        return badRequest(res, 'Cliente y número de cuenta son obligatorios');
    }

    try {
        // Verificar si ya existe
        const existing = await query('SELECT id FROM bans WHERE account_number = $1', [account_number]);
        if (existing.length > 0) {
            return badRequest(res, 'El número de cuenta BAN ya existe');
        }

        // Asignar vendedor si no viene (similar a clientes)
        let finalVendorId = vendor_id;
        if (!finalVendorId && req.user && req.user.salespersonId) {
            const vendorRes = await query('SELECT id FROM vendors WHERE salesperson_id = $1', [req.user.salespersonId]);
            if (vendorRes.length > 0) {
                finalVendorId = vendorRes[0].id;
            }
        }

        const result = await query(
            `INSERT INTO bans
        (client_id, account_number, address, city, zip_code, vendor_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,1,NOW(),NOW())
       RETURNING *`,
            [client_id, account_number, address, city, zip_code, finalVendorId]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando BAN');
    }
};

export const updateBan = async (req, res) => {
    const { id } = req.params;
    const {
        account_number,
        address,
        city,
        zip_code,
        vendor_id,
        is_active
    } = req.body;

    try {
        const existing = await query('SELECT id FROM bans WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'BAN');
        }

        const result = await query(
            `UPDATE bans
          SET account_number = COALESCE($1, account_number),
              address = COALESCE($2, address),
              city = COALESCE($3, city),
              zip_code = COALESCE($4, zip_code),
              vendor_id = COALESCE($5, vendor_id),
              is_active = COALESCE($6, is_active),
              updated_at = NOW()
        WHERE id = $7
        RETURNING *`,
            [
                account_number, address, city, zip_code, vendor_id,
                is_active !== undefined ? (is_active ? 1 : 0) : undefined, id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando BAN');
    }
};
