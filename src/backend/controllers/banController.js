import { getClient, query } from '../database/db.js';
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

    // VALIDACIÓN OBLIGATORIA: Tipo de cuenta es requerido
    if (!req.body.account_type || req.body.account_type.trim() === '') {
        return badRequest(res, 'Tipo de cuenta (account_type) es obligatorio. Debe ser Móvil, Fijo, o Convergente.');
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

        // VALIDACIÓN: Si se intenta cambiar account_type, no puede estar vacío
        if ('account_type' in req.body && (!account_type || account_type.trim() === '')) {
            return badRequest(res, 'Tipo de cuenta no puede estar vacío. Debe ser Móvil, Fijo, o Convergente.');
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

export const deleteBan = async (req, res) => {
    const { id } = req.params;
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const banResult = await client.query(
            'SELECT id FROM bans WHERE id = $1 LIMIT 1',
            [id]
        );

        if (banResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return notFound(res, 'BAN');
        }

        const activeSubsResult = await client.query(
            `SELECT COUNT(*)::int AS total
             FROM subscribers
             WHERE ban_id = $1
               AND COALESCE(LOWER(status), 'activo') NOT IN ('cancelado', 'cancelled', 'no_renueva_ahora')`,
            [id]
        );

        const activeSubscribers = Number(activeSubsResult.rows[0]?.total || 0);
        if (activeSubscribers > 0) {
            await client.query('ROLLBACK');
            return badRequest(res, 'No se puede eliminar el BAN porque tiene líneas activas.');
        }

        const subscriberIdsResult = await client.query(
            'SELECT id FROM subscribers WHERE ban_id = $1',
            [id]
        );
        const subscriberIds = subscriberIdsResult.rows.map((row) => row.id);

        let deletedReports = 0;
        let deletedSubscribers = 0;

        if (subscriberIds.length > 0) {
            const reportsResult = await client.query(
                'DELETE FROM subscriber_reports WHERE subscriber_id = ANY($1::uuid[])',
                [subscriberIds]
            );
            deletedReports = reportsResult.rowCount || 0;

            const subscribersResult = await client.query(
                'DELETE FROM subscribers WHERE id = ANY($1::uuid[])',
                [subscriberIds]
            );
            deletedSubscribers = subscribersResult.rowCount || 0;
        }

        const banDeleteResult = await client.query(
            'DELETE FROM bans WHERE id = $1 RETURNING id',
            [id]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            ban: banDeleteResult.rows[0],
            deleted_reports: deletedReports,
            deleted_subscribers: deletedSubscribers
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_rollbackError) {
            // ignore rollback error
        }
        return serverError(res, error, 'Error eliminando BAN');
    } finally {
        client.release();
    }
};
