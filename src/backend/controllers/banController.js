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
        ban_number,
        address = null,
        city = null,
        zip_code = null,
        vendor_id = null
    } = req.body;

    if (!client_id || !ban_number) {
        return badRequest(res, 'Cliente y número de cuenta son obligatorios');
    }

    try {
        // Verificar si ya existe
        const existing = await query('SELECT id FROM bans WHERE ban_number = $1', [ban_number]);
        if (existing.length > 0) {
            return badRequest(res, 'El número de cuenta BAN ya existe');
        }

        const result = await query(
            `INSERT INTO bans
        (client_id, ban_number, account_type, status, created_at, updated_at)
       VALUES ($1,$2,$3,'A',NOW(),NOW())
       RETURNING *`,
            [client_id, ban_number, req.body.account_type || null]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando BAN');
    }
};

export const updateBan = async (req, res) => {
    const { id } = req.params;
    const {
        ban_number,
        account_type,
        status
    } = req.body;

    try {
        const existing = await query('SELECT id FROM bans WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'BAN');
        }

        // Convertir strings vacíos a undefined para que COALESCE funcione correctamente
        const cleanAccountType = account_type?.trim() || undefined;
        const cleanStatus = status?.trim() || undefined;

        const result = await query(
            `UPDATE bans
          SET ban_number = COALESCE($1, ban_number),
              account_type = COALESCE($2, account_type),
              status = COALESCE($3, status),
              updated_at = NOW()
        WHERE id = $4
        RETURNING *`,
            [
                ban_number, 
                cleanAccountType, 
                cleanStatus, 
                id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando BAN');
    }
};
