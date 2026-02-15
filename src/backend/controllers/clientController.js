import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

export const mergeClients = async (req, res) => {
    const { sourceId, targetId } = req.body;

    if (!sourceId || !targetId) {
        return badRequest(res, 'Se requieren sourceId y targetId');
    }

    if (sourceId === targetId) {
        return badRequest(res, 'No se puede fusionar el mismo cliente');
    }

    try {
        // 1. Verificar que ambos existan
        const source = await query('SELECT * FROM clients WHERE id = $1', [sourceId]);
        const target = await query('SELECT * FROM clients WHERE id = $1', [targetId]);

        if (source.length === 0 || target.length === 0) {
            return notFound(res, 'Uno o ambos clientes no existen');
        }

        // 2. Mover BANs
        await query('UPDATE bans SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);

        // 3. Mover Seguimientos (FollowUps)
        try {
            await query('UPDATE follow_ups SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);
        } catch (e) {
            console.warn("No se pudo actualizar follow_ups", e.message);
        }

        // 4. Eliminar Cliente Origen
        await query('DELETE FROM clients WHERE id = $1', [sourceId]);

        res.json({ success: true, message: `Cliente ${sourceId} fusionado en ${targetId} correctamente.` });

    } catch (error) {
        serverError(res, error, 'Error fusionando clientes');
    }
};

export const searchClients = async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.json([]);
    }

    try {
        const searchTerm = `%${q}%`;
        const clients = await query(
            `SELECT DISTINCT c.* 
             FROM clients c
             LEFT JOIN bans b ON c.id = b.client_id
             WHERE c.name ILIKE $1 
                OR c.email ILIKE $1 
                OR CAST(b.ban_number AS text) ILIKE $1
             LIMIT 20`,
            [searchTerm]
        );
        res.json(clients);
    } catch (error) {
        serverError(res, error, 'Error buscando clientes');
    }
};

export const getClients = async (req, res) => {
    try {
        const { tab } = req.query;
        const conditions = [];
        const params = [];

        // FILTROS POR TAB - CON FILTRO DE STATUS CORREGIDO
        if (tab === 'cancelled') {
            // CANCELADOS: Clientes CON TODOS LOS BANs cancelados (ninguno activo)
            conditions.push(`EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)`);
            conditions.push(`NOT EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo'))`);
            conditions.push(`(c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL')`);
        } else if (tab === 'active' || !tab) {
            // ACTIVOS: Clientes CON AL MENOS UN BAN ACTIVO O sin BANs (recién creados)
            conditions.push(`(
                EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo'))
                OR NOT EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
            )`);
            conditions.push(`(c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL')`);
        } else if (tab === 'following') {
            conditions.push(`EXISTS (SELECT 1 FROM follow_up_prospects f WHERE f.client_id = c.id AND f.completed_date IS NULL)`);
            conditions.push(`EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)`);
        } else if (tab === 'completed') {
            conditions.push(`EXISTS (SELECT 1 FROM follow_up_prospects f WHERE f.client_id = c.id AND f.completed_date IS NOT NULL)`);
        } else if (tab === 'incomplete') {
            conditions.push(`(c.name IS NULL OR c.name = '' OR c.name = 'NULL')`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const clients = await query(
            `SELECT c.*,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo')) as active_ban_count,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND (b.status = 'C' OR LOWER(b.status) = 'inactivo')) as cancelled_ban_count,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id) as ban_count,
            (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as active_subscriber_count,
            (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as subscriber_count,
            (SELECT string_agg(CAST(s.phone AS text), ', ') FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as subscriber_phones,
            (
                SELECT json_agg(json_build_object(
                    'ban_number', CAST(b.ban_number AS text), 
                    'phone', CAST(s.phone AS text)
                ))
                FROM bans b
                JOIN subscribers s ON s.ban_id = b.id
                WHERE b.client_id = c.id
            ) as subscribers_detail,
            (SELECT string_agg(CAST(b.ban_number AS text), ', ') FROM bans b WHERE b.client_id = c.id) as ban_numbers,
            (SELECT COUNT(*) > 0 FROM bans b WHERE b.client_id = c.id) as has_bans,
            (SELECT COUNT(*) > 0 FROM bans b WHERE b.client_id = c.id AND b.status = 'C') as has_cancelled_bans,
            (SELECT s.phone FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id ORDER BY s.contract_end_date ASC NULLS LAST LIMIT 1) as primary_subscriber_phone,
            (SELECT MIN(s.contract_end_date) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND s.contract_end_date IS NOT NULL) as primary_contract_end_date,
            (SELECT MIN(s.created_at) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as primary_subscriber_created_at,
            (SELECT b.account_type FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo') LIMIT 1) as primary_service_type,
            (SELECT string_agg(DISTINCT b.account_type, ', ') FROM bans b WHERE b.client_id = c.id AND b.account_type IS NOT NULL) as all_service_types,
            sp.name as vendor_name,
            (SELECT MAX(GREATEST(COALESCE(s2.updated_at, s2.created_at), COALESCE(b2.updated_at, b2.created_at))) FROM subscribers s2 JOIN bans b2 ON s2.ban_id = b2.id WHERE b2.client_id = c.id) as last_activity
       FROM clients c
       LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
       ${whereClause}
       ORDER BY c.created_at DESC`,
            params
        );

        // Calcular contadores para todos los tabs
        const stats = await query(`
            SELECT 
                (SELECT COUNT(DISTINCT c.id) FROM clients c 
                 WHERE (
                   EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
                   OR NOT EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
                 )
                 AND (c.name IS NOT NULL AND c.name <> '' AND c.name <> 'NULL')) as active_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c 
                 WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'C')
                 AND NOT EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo'))
                 AND (c.name IS NOT NULL AND c.name <> '' AND c.name <> 'NULL')) as cancelled_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c
                 WHERE EXISTS (SELECT 1 FROM follow_up_prospects f WHERE f.client_id = c.id AND f.completed_date IS NULL)) as following_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c
                 WHERE EXISTS (SELECT 1 FROM follow_up_prospects f WHERE f.client_id = c.id AND f.completed_date IS NOT NULL)) as completed_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c 
                 WHERE (c.name IS NULL OR c.name = '' OR c.name = 'NULL')) as incomplete_count
        `);

        res.json({
            clients: clients,
            stats: stats[0]
        });
    } catch (error) {
        serverError(res, error, 'Error obteniendo clientes');
    }
};

export const getClientById = async (req, res) => {
    const { id } = req.params;
    try {
        const clients = await query('SELECT * FROM clients WHERE id = $1', [id]);
        if (clients.length === 0) {
            return notFound(res, 'Cliente');
        }
        res.json(clients[0]);
    } catch (error) {
        serverError(res, error, 'Error obteniendo cliente');
    }
};

export const createClient = async (req, res) => {
    const {
        owner_name = null,
        name,
        contact_person = null,
        email = null,
        phone = null,
        additional_phone = null,
        cellular = null,
        address = null,
        city = null,
        zip_code = null,
        includes_ban = 0,
        vendor_id = null
    } = req.body;

    if (!name) {
        return badRequest(res, 'El nombre de la empresa es obligatorio');
    }

    try {
        const salespersonId = req.user?.salespersonId || null;

        // VALIDACIÓN OBLIGATORIA: Vendedor debe estar asignado
        if (!salespersonId) {
            return badRequest(res, 'Vendedor asignado es obligatorio. No se puede crear un cliente sin vendedor.');
        }

        // VALIDACIÓN: Verificar que no exista un cliente con el mismo nombre
        const existingClient = await query(
            'SELECT id, name FROM clients WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))',
            [name]
        );

        if (existingClient.length > 0) {
            return badRequest(res, 
                `Ya existe un cliente con el nombre "${existingClient[0].name}". ` +
                `No se permiten nombres duplicados. ID existente: ${existingClient[0].id}`
            );
        }

        const result = await query(
            `INSERT INTO clients
        (owner_name, name, contact_person, email, phone, additional_phone, cellular, address, city, zip_code, salesperson_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
       RETURNING *`,
            [
                owner_name?.trim() || null,
                name.trim(),
                contact_person,
                email,
                phone,
                additional_phone,
                cellular,
                address,
                city,
                zip_code,
                salespersonId
            ]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando cliente');
    }
};

export const updateClient = async (req, res) => {
    const { id } = req.params;
    const {
        owner_name,
        name,
        contact_person,
        email,
        phone,
        additional_phone,
        cellular,
        address,
        city,
        zip_code,
        includes_ban,
        vendor_id,
        salesperson_id
    } = req.body;

    try {
        const existing = await query('SELECT id FROM clients WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Cliente');
        }

        // Si se envía salesperson_id explícitamente (puede ser null para desasignar)
        const hasSalespersonUpdate = 'salesperson_id' in req.body;

        // Validar que salesperson_id sea UUID válido (no integer legacy)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let safeSalespersonId = salesperson_id || null;
        if (safeSalespersonId && !uuidRegex.test(safeSalespersonId)) {
            console.warn(`⚠️ salesperson_id no es UUID válido: "${safeSalespersonId}" — ignorando`);
            safeSalespersonId = null;
        }

        let result;
        if (hasSalespersonUpdate) {
            result = await query(
                `UPDATE clients
              SET owner_name = COALESCE($1, owner_name),
                  name = COALESCE($2, name),
                  contact_person = COALESCE($3, contact_person),
                  email = COALESCE($4, email),
                  phone = COALESCE($5, phone),
                  additional_phone = COALESCE($6, additional_phone),
                  cellular = COALESCE($7, cellular),
                  address = COALESCE($8, address),
                  city = COALESCE($9, city),
                  zip_code = COALESCE($10, zip_code),
                  salesperson_id = $11,
                  updated_at = NOW()
            WHERE id = $12
            RETURNING *`,
                [
                    owner_name, name, contact_person, email, phone, additional_phone, cellular,
                    address, city, zip_code, safeSalespersonId, id
                ]
            );
        } else {
            result = await query(
                `UPDATE clients
              SET owner_name = COALESCE($1, owner_name),
                  name = COALESCE($2, name),
                  contact_person = COALESCE($3, contact_person),
                  email = COALESCE($4, email),
                  phone = COALESCE($5, phone),
                  additional_phone = COALESCE($6, additional_phone),
                  cellular = COALESCE($7, cellular),
                  address = COALESCE($8, address),
                  city = COALESCE($9, city),
                  zip_code = COALESCE($10, zip_code),
                  updated_at = NOW()
            WHERE id = $11
            RETURNING *`,
                [
                    owner_name, name, contact_person, email, phone, additional_phone, cellular,
                    address, city, zip_code, id
                ]
            );
        }

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando cliente');
    }
};

/**
 * GET /api/clients/check-duplicate?name=NOMBRE
 * Verifica si existe un cliente con el mismo nombre (case-insensitive, trimmed)
 */
export const checkDuplicateClient = async (req, res) => {
    const { name } = req.query;

    if (!name || name.trim() === '') {
        return badRequest(res, 'name es requerido');
    }

    try {
        const existing = await query(
            'SELECT id, name FROM clients WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))',
            [name]
        );

        res.json({
            exists: existing.length > 0,
            existingName: existing[0]?.name || null,
            existingId: existing[0]?.id || null
        });
    } catch (error) {
        serverError(res, error, 'Error verificando duplicado');
    }
};
