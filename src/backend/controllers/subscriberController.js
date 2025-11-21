import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

export const getSubscribers = async (req, res) => {
    const { ban_id } = req.query;
    try {
        let sql = 'SELECT * FROM subscribers';
        const params = [];
        if (ban_id) {
            sql += ' WHERE ban_id = $1';
            params.push(ban_id);
        }
        sql += ' ORDER BY created_at DESC';

        const subscribers = await query(sql, params);
        res.json(subscribers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo suscriptores');
    }
};

export const createSubscriber = async (req, res) => {
    const {
        ban_id,
        subscriber_number,
        address = null,
        city = null,
        zip_code = null,
        vendor_id = null
    } = req.body;

    if (!ban_id || !subscriber_number) {
        return badRequest(res, 'BAN y número de suscriptor son obligatorios');
    }

    try {
        // Verificar si ya existe
        const existing = await query('SELECT id FROM subscribers WHERE subscriber_number = $1', [subscriber_number]);
        if (existing.length > 0) {
            return badRequest(res, 'El número de suscriptor ya existe');
        }

        // Asignar vendedor
        let finalVendorId = vendor_id;
        if (!finalVendorId && req.user && req.user.salespersonId) {
            const vendorRes = await query('SELECT id FROM vendors WHERE salesperson_id = $1', [req.user.salespersonId]);
            if (vendorRes.length > 0) {
                finalVendorId = vendorRes[0].id;
            }
        }

        const result = await query(
            `INSERT INTO subscribers
        (ban_id, subscriber_number, address, city, zip_code, vendor_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,1,NOW(),NOW())
       RETURNING *`,
            [ban_id, subscriber_number, address, city, zip_code, finalVendorId]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando suscriptor');
    }
};

export const updateSubscriber = async (req, res) => {
    const { id } = req.params;
    const {
        subscriber_number,
        address,
        city,
        zip_code,
        vendor_id,
        is_active
    } = req.body;

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        const result = await query(
            `UPDATE subscribers
          SET subscriber_number = COALESCE($1, subscriber_number),
              address = COALESCE($2, address),
              city = COALESCE($3, city),
              zip_code = COALESCE($4, zip_code),
              vendor_id = COALESCE($5, vendor_id),
              is_active = COALESCE($6, is_active),
              updated_at = NOW()
        WHERE id = $7
        RETURNING *`,
            [
                subscriber_number, address, city, zip_code, vendor_id,
                is_active !== undefined ? (is_active ? 1 : 0) : undefined, id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando suscriptor');
    }
};
