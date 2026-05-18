import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const normalizeClientName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeClientNameKey = (value) => normalizeClientName(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const VALID_CLIENT_NAME_SQL = `(c.name IS NOT NULL AND c.name <> '' AND c.name <> 'NULL')`;
const ACTIVE_FOLLOW_UP_EXISTS_SQL = `
    EXISTS (
        SELECT 1
        FROM follow_up_prospects f
        WHERE f.client_id = c.id
          AND f.completed_date IS NULL
          AND COALESCE(f.is_active::text, 'true') IN ('true', '1', 't')
    )
`;
const ACTIVE_CLIENT_RELATION_SQL = `
    EXISTS (
        SELECT 1
        FROM bans b
        WHERE b.client_id = c.id
          AND COALESCE(LOWER(b.status::text), '') IN ('a', 'activo', 'active')
          AND (
            NOT EXISTS (
                SELECT 1
                FROM subscribers s_any
                WHERE s_any.ban_id = b.id
            )
            OR EXISTS (
                SELECT 1
                FROM subscribers s
                WHERE s.ban_id = b.id
                  AND COALESCE(LOWER(s.status::text), 'activo') NOT IN ('cancelado', 'cancelled', 'c', 'inactivo', 'inactive', 'no_renueva_ahora')
            )
          )
    )
`;
const ACTIVE_CLIENT_SQL = `
    ${VALID_CLIENT_NAME_SQL}
    AND ${ACTIVE_CLIENT_RELATION_SQL}
    AND NOT (${ACTIVE_FOLLOW_UP_EXISTS_SQL})
`;
const FOLLOWING_VISIBLE_NAME_SQL = `
    COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NOT NULL
`;
const FOLLOWING_CLIENT_SQL = `
    ${FOLLOWING_VISIBLE_NAME_SQL}
    AND ${ACTIVE_FOLLOW_UP_EXISTS_SQL}
    AND EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
`;
const CANCELLED_CLIENT_SQL = `
    ${VALID_CLIENT_NAME_SQL}
    AND EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
    AND NOT (${ACTIVE_CLIENT_RELATION_SQL})
`;
const SCORING_EXPIRING_DAYS = 90;

function isExpiringSoon(contractEndDate) {
    if (!contractEndDate) return false;
    const date = new Date(contractEndDate);
    if (Number.isNaN(date.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + SCORING_EXPIRING_DAYS);

    return date <= horizon;
}

function scoreClient(client) {
    let score = 0;

    if (Number(client.active_ban_count || 0) > 0) score += 20;
    if (!client.has_convergence) score += 30;
    if (client.primary_contract_end_date && isExpiringSoon(client.primary_contract_end_date)) score += 40;
    if (!client.recent_followup) score += 20;

    return score;
}

function enrichClientScoring(client) {
    const enriched = {
        ...client,
        active_ban_count: Number(client.active_ban_count || 0),
        has_convergence: Boolean(client.has_convergence),
        recent_followup: Boolean(client.recent_followup),
        primary_contract_end_date: client.primary_contract_end_date || null
    };

    return {
        ...enriched,
        priority_score: scoreClient(enriched)
    };
}

const findClientDuplicate = async ({ name, phone, excludeId = null }) => {
    const nameKey = normalizeClientNameKey(name);
    const phoneDigits = normalizeDigits(phone);
    const params = [];
    const filters = [];

    if (nameKey) {
        params.push(nameKey);
        filters.push(`(
            regexp_replace(upper(trim(coalesce(name, ''))), '[^A-Z0-9]+', '', 'g') = $${params.length}
            OR regexp_replace(upper(trim(coalesce(business_name, ''))), '[^A-Z0-9]+', '', 'g') = $${params.length}
        )`);
    }

    if (phoneDigits) {
        params.push(phoneDigits);
        filters.push(`(
            regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $${params.length}
            OR regexp_replace(coalesce(additional_phone, ''), '\\D', '', 'g') = $${params.length}
            OR regexp_replace(coalesce(cellular, ''), '\\D', '', 'g') = $${params.length}
        )`);
    }

    if (filters.length === 0) return null;

    if (excludeId !== null && excludeId !== undefined) {
        params.push(excludeId);
    }

    const excludeClause = excludeId !== null && excludeId !== undefined
        ? `AND id <> $${params.length}`
        : '';

    const rows = await query(
        `SELECT id, name, phone, additional_phone, cellular
         FROM clients
         WHERE (${filters.join(' OR ')})
         ${excludeClause}
         ORDER BY created_at DESC
         LIMIT 1`,
        params
    );

    return rows[0] || null;
};

const resolveSalespersonIdFromVendor = async (vendorId) => {
    if (vendorId === null || vendorId === undefined || vendorId === '') return null;

    try {
        const rows = await query(
            'SELECT salesperson_id FROM vendor_salesperson_mapping WHERE vendor_id = $1 LIMIT 1',
            [vendorId]
        );
        return rows?.[0]?.salesperson_id || null;
    } catch (error) {
        // Tabla de mapping ausente en algún entorno
        if (error?.code === '42P01') return null;
        throw error;
    }
};

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
        const params = [searchTerm];
        const clients = await query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo')) as active_ban_count,
                    (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND (b.status = 'C' OR LOWER(b.status) = 'inactivo')) as cancelled_ban_count,
                    (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id) as ban_count,
                    (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND COALESCE(LOWER(s.status), 'activo') NOT IN ('cancelado', 'cancelled', 'no_renueva_ahora')) as active_subscriber_count,
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
                    (SELECT s.phone FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND COALESCE(LOWER(s.status), 'activo') NOT IN ('cancelado', 'cancelled', 'no_renueva_ahora') ORDER BY s.contract_end_date ASC NULLS LAST LIMIT 1) as primary_subscriber_phone,
                    (SELECT MIN(s.contract_end_date) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND s.contract_end_date IS NOT NULL AND COALESCE(LOWER(s.status), 'activo') NOT IN ('cancelado', 'cancelled', 'no_renueva_ahora')) as primary_contract_end_date,
                    (SELECT MIN(s.created_at) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as primary_subscriber_created_at,
                    (SELECT b.account_type FROM bans b WHERE b.client_id = c.id AND (b.status = 'A' OR LOWER(b.status) = 'activo') LIMIT 1) as primary_service_type,
                    (SELECT string_agg(DISTINCT b.account_type, ', ') FROM bans b WHERE b.client_id = c.id AND b.account_type IS NOT NULL) as all_service_types,
                    sp.name as vendor_name,
                    (SELECT MAX(GREATEST(COALESCE(s2.updated_at, s2.created_at), COALESCE(b2.updated_at, b2.created_at))) FROM subscribers s2 JOIN bans b2 ON s2.ban_id = b2.id WHERE b2.client_id = c.id) as last_activity,
                    (SELECT MIN(s.remaining_payments) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND COALESCE(LOWER(s.status), 'activo') NOT IN ('cancelado', 'cancelled', 'no_renueva_ahora')) as min_remaining_payments
             FROM clients c
             LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
             WHERE (
               COALESCE(c.name, '') ILIKE $1
               OR COALESCE(c.business_name, '') ILIKE $1
               OR COALESCE(c.email, '') ILIKE $1
               OR COALESCE(c.phone, '') ILIKE $1
               OR COALESCE(c.additional_phone, '') ILIKE $1
               OR COALESCE(c.cellular, '') ILIKE $1
               OR COALESCE(c.contact_person, '') ILIKE $1
               OR COALESCE(c.address, '') ILIKE $1
               OR COALESCE(c.city, '') ILIKE $1
               OR EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND CAST(b.ban_number AS text) ILIKE $1)
               OR EXISTS (
                    SELECT 1
                    FROM subscribers s
                    JOIN bans b ON s.ban_id = b.id
                    WHERE b.client_id = c.id
                      AND CAST(s.phone AS text) ILIKE $1
               )
             )
             ORDER BY min_remaining_payments ASC NULLS LAST, c.created_at DESC
             LIMIT 100`,
            params
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
            conditions.push(`(${CANCELLED_CLIENT_SQL})`);
        } else if (tab === 'active' || !tab) {
            // ACTIVOS: Clientes CON AL MENOS UN BAN ACTIVO O sin BANs (recién creados)
            // EXCLUIR clientes que están en seguimiento activo
            conditions.push(`(${ACTIVE_CLIENT_SQL})`);
        } else if (tab === 'following') {
            conditions.push(`(${FOLLOWING_CLIENT_SQL})`);
        } else if (tab === 'completed') {
            conditions.push(`EXISTS (SELECT 1 FROM follow_up_prospects f WHERE f.client_id = c.id AND f.completed_date IS NOT NULL)`);
        } else if (tab === 'incomplete') {
            conditions.push(`(c.name IS NULL OR c.name = '' OR c.name = 'NULL')`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const clients = await query(
            `SELECT c.*,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND COALESCE(LOWER(b.status::text), '') IN ('a', 'activo', 'active')) as active_ban_count,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND COALESCE(LOWER(b.status::text), '') IN ('c', 'cancelado', 'cancelled', 'inactivo', 'inactive')) as cancelled_ban_count,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id) as ban_count,
            (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND COALESCE(LOWER(s.status::text), 'activo') NOT IN ('cancelado', 'cancelled', 'c', 'inactivo', 'inactive', 'no_renueva_ahora')) as active_subscriber_count,
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
            (SELECT COUNT(*) > 0 FROM bans b WHERE b.client_id = c.id AND COALESCE(LOWER(b.status::text), '') IN ('c', 'cancelado', 'cancelled', 'inactivo', 'inactive')) as has_cancelled_bans,
            (SELECT s.phone FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND COALESCE(LOWER(s.status::text), 'activo') NOT IN ('cancelado', 'cancelled', 'c', 'inactivo', 'inactive', 'no_renueva_ahora') ORDER BY s.contract_end_date ASC NULLS LAST LIMIT 1) as primary_subscriber_phone,
            (SELECT MIN(s.contract_end_date) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND s.contract_end_date IS NOT NULL AND COALESCE(LOWER(s.status::text), 'activo') NOT IN ('cancelado', 'cancelled', 'c', 'inactivo', 'inactive', 'no_renueva_ahora')) as primary_contract_end_date,
            (SELECT MIN(s.created_at) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as primary_subscriber_created_at,
            (SELECT b.account_type FROM bans b WHERE b.client_id = c.id AND COALESCE(LOWER(b.status::text), '') IN ('a', 'activo', 'active') LIMIT 1) as primary_service_type,
            (SELECT string_agg(DISTINCT b.account_type, ', ') FROM bans b WHERE b.client_id = c.id AND b.account_type IS NOT NULL) as all_service_types,
            (
                EXISTS (
                    SELECT 1
                    FROM bans b
                    WHERE b.client_id = c.id
                      AND COALESCE(LOWER(b.status::text), '') IN ('a', 'activo', 'active')
                      AND LOWER(COALESCE(b.account_type, '')) LIKE '%converg%'
                )
                OR (
                    EXISTS (
                        SELECT 1
                        FROM bans b
                        WHERE b.client_id = c.id
                          AND COALESCE(LOWER(b.status::text), '') IN ('a', 'activo', 'active')
                          AND (
                            LOWER(COALESCE(b.account_type, '')) LIKE '%movil%'
                            OR LOWER(COALESCE(b.account_type, '')) LIKE '%móvil%'
                            OR LOWER(COALESCE(b.account_type, '')) LIKE '%mobile%'
                          )
                    )
                    AND EXISTS (
                        SELECT 1
                        FROM bans b
                        WHERE b.client_id = c.id
                          AND COALESCE(LOWER(b.status::text), '') IN ('a', 'activo', 'active')
                          AND (
                            LOWER(COALESCE(b.account_type, '')) LIKE '%fijo%'
                            OR LOWER(COALESCE(b.account_type, '')) LIKE '%fixed%'
                            OR LOWER(COALESCE(b.account_type, '')) LIKE '%pyme%'
                            OR LOWER(COALESCE(b.account_type, '')) LIKE '%residencial%'
                          )
                    )
                )
            ) as has_convergence,
            EXISTS (
                SELECT 1
                FROM follow_up_prospects f
                WHERE f.client_id = c.id
                  AND GREATEST(
                    COALESCE(f.last_call_date::timestamp, '1970-01-01'::timestamp),
                    COALESCE(f.updated_at::timestamp, '1970-01-01'::timestamp),
                    COALESCE(f.created_at::timestamp, '1970-01-01'::timestamp)
                  ) >= NOW() - INTERVAL '30 days'
            ) as recent_followup,
            sp.name as vendor_name,
            (SELECT MAX(GREATEST(COALESCE(s2.updated_at, s2.created_at), COALESCE(b2.updated_at, b2.created_at))) FROM subscribers s2 JOIN bans b2 ON s2.ban_id = b2.id WHERE b2.client_id = c.id) as last_activity,
            (SELECT MIN(s.remaining_payments) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND COALESCE(LOWER(s.status), 'activo') NOT IN ('cancelado', 'cancelled', 'no_renueva_ahora')) as min_remaining_payments
       FROM clients c
       LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
       ${whereClause}
       ORDER BY min_remaining_payments ASC NULLS LAST, c.created_at DESC`,
            params
        );

        // Calcular contadores para todos los tabs
        const stats = await query(`
            SELECT 
                (SELECT COUNT(DISTINCT c.id) FROM clients c
                 WHERE ${ACTIVE_CLIENT_SQL}) as active_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c 
                 WHERE ${CANCELLED_CLIENT_SQL}) as cancelled_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c
                 WHERE ${FOLLOWING_CLIENT_SQL}
                 ) as following_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c
                 WHERE EXISTS (SELECT 1 FROM follow_up_prospects f WHERE f.client_id = c.id AND f.completed_date IS NOT NULL)
                 ) as completed_count,
                (SELECT COUNT(DISTINCT c.id) FROM clients c 
                 WHERE (c.name IS NULL OR c.name = '' OR c.name = 'NULL')
                 ) as incomplete_count
        `, []);

        const enrichedClients = clients.map(enrichClientScoring);

        res.json({
            clients: enrichedClients,
            stats: stats[0]
        });
    } catch (error) {
        serverError(res, error, 'Error obteniendo clientes');
    }
};

export const getClientById = async (req, res) => {
    const { id } = req.params;
    try {
        const clients = await query(
            `SELECT c.*, sp.name AS vendor_name
               FROM clients c
               LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
              WHERE c.id = $1`,
            [id]
        );
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
        tax_id = null,
        notes = null,
        includes_ban = 0,
        vendor_id = null
    } = req.body;

    const normalizedName = normalizeClientName(name);

    if (!normalizedName) {
        return badRequest(res, 'El nombre de la empresa es obligatorio');
    }

    try {
        let salespersonId = req.user?.salespersonId || null;
        const requestedSalespersonId = typeof req.body?.salesperson_id === 'string'
            ? req.body.salesperson_id.trim()
            : null;

        // Si no viene desde token (admin/supervisor), usar salesperson_id enviado por frontend.
        if (!salespersonId && requestedSalespersonId && isValidUuid(requestedSalespersonId)) {
            salespersonId = requestedSalespersonId;
        }

        // Fallback legacy: vendor_id (int) -> salesperson_id (uuid)
        if (!salespersonId && vendor_id !== null && vendor_id !== undefined) {
            salespersonId = await resolveSalespersonIdFromVendor(vendor_id);
        }

        // Regla operativa: se pueden crear clientes sin vendedor.
        // Solo persistimos salesperson_id si realmente es un UUID valido.
        if (salespersonId && !isValidUuid(String(salespersonId))) {
            salespersonId = null;
        }

        // VALIDACIÃ“N: Verificar que no exista un cliente con el mismo nombre
        const existingClient = await findClientDuplicate({ name: normalizedName, phone });

        if (existingClient) {
            return badRequest(res, 
                `Ya existe un cliente con ese nombre o teléfono: "${existingClient.name}". ` +
                `No se permiten duplicados. ID existente: ${existingClient.id}`
            );
        }

        const result = await query(
            `INSERT INTO clients
        (owner_name, name, contact_person, email, phone, additional_phone, cellular, address, city, zip_code, tax_id, notes, includes_ban, salesperson_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
       RETURNING *`,
            [
                owner_name?.trim() || null,
                normalizedName,
                contact_person,
                email,
                phone,
                additional_phone,
                cellular,
                address,
                city,
                zip_code,
                tax_id?.trim?.() || tax_id || null,
                notes,
                Boolean(includes_ban),
                salespersonId || null
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
        business_name,
        contact_person,
        email,
        phone,
        additional_phone,
        cellular,
        address,
        city,
        zip_code,
        tax_id,
        notes,
        includes_ban,
        vendor_id,
        salesperson_id
    } = req.body;

    try {
        if (req.user?.role === 'vendedor' && !req.user?.salespersonId) {
            return res.status(403).json({ error: 'Usuario vendedor sin vendedor asignado' });
        }
        const existing = await query('SELECT id, salesperson_id FROM clients WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Cliente');
        }
        if (req.user?.role === 'vendedor' && req.user?.salespersonId) {
            const owner = existing[0].salesperson_id;
            const isOwnedByOther = owner && String(owner) !== String(req.user.salespersonId);
            if (isOwnedByOther) {
                return res.status(403).json({ error: 'No tienes acceso a este cliente' });
            }
        }

        // Si se envía salesperson_id explícitamente (puede ser null para desasignar)
        if (name !== undefined || phone !== undefined) {
            const duplicate = await findClientDuplicate({ name, phone, excludeId: id });
            if (duplicate) {
                return badRequest(
                    res,
                    `Ya existe un cliente con ese nombre o teléfono: "${duplicate.name}". ID existente: ${duplicate.id}`
                );
            }
        }

        const hasSalespersonUpdate = ('salesperson_id' in req.body) || ('vendor_id' in req.body);

        let safeSalespersonId = null;
        if (typeof salesperson_id === 'string' && salesperson_id.trim() !== '') {
            safeSalespersonId = salesperson_id.trim();
        }

        if (safeSalespersonId && !isValidUuid(safeSalespersonId)) {
            console.warn(`salesperson_id no es UUID válido: "${safeSalespersonId}" — se intentará mapear por vendor_id`);
            safeSalespersonId = null;
        }

        // Fallback legacy: vendor_id (int) -> salesperson_id (uuid)
        if (!safeSalespersonId && vendor_id !== null && vendor_id !== undefined && vendor_id !== '') {
            safeSalespersonId = await resolveSalespersonIdFromVendor(vendor_id);
        }

        // Para vendedores:
        // - si intentan asignar otro vendedor, se mantiene su propio salesperson_id.
        // - si envían explícitamente salesperson_id: null, se permite desasignar (devolver al pool).
        if (req.user?.role === 'vendedor' && req.user?.salespersonId && isValidUuid(String(req.user.salespersonId))) {
            const salespersonSent = Object.prototype.hasOwnProperty.call(req.body, 'salesperson_id');
            if (!salespersonSent) {
                safeSalespersonId = String(req.user.salespersonId);
            } else if (salesperson_id !== null) {
                safeSalespersonId = String(req.user.salespersonId);
            }
        }

        let result;
        if (hasSalespersonUpdate) {
            result = await query(
                `UPDATE clients
              SET owner_name = COALESCE($1, owner_name),
                  name = COALESCE($2, name),
                  business_name = COALESCE($3, business_name),
                  contact_person = COALESCE($4, contact_person),
                  email = COALESCE($5, email),
                  phone = COALESCE($6, phone),
                  additional_phone = COALESCE($7, additional_phone),
                  cellular = COALESCE($8, cellular),
                  address = COALESCE($9, address),
                  city = COALESCE($10, city),
                  zip_code = COALESCE($11, zip_code),
                  tax_id = COALESCE($12, tax_id),
                  notes = COALESCE($13, notes),
                  includes_ban = COALESCE($14, includes_ban),
                  salesperson_id = $15,
                  updated_at = NOW()
            WHERE id = $16
            RETURNING *`,
                [
                    owner_name, name, business_name, contact_person, email, phone, additional_phone, cellular,
                    address, city, zip_code, tax_id, notes,
                    includes_ban === undefined ? null : Boolean(includes_ban),
                    safeSalespersonId, id
                ]
            );
        } else {
            result = await query(
                `UPDATE clients
              SET owner_name = COALESCE($1, owner_name),
                  name = COALESCE($2, name),
                  business_name = COALESCE($3, business_name),
                  contact_person = COALESCE($4, contact_person),
                  email = COALESCE($5, email),
                  phone = COALESCE($6, phone),
                  additional_phone = COALESCE($7, additional_phone),
                  cellular = COALESCE($8, cellular),
                  address = COALESCE($9, address),
                  city = COALESCE($10, city),
                  zip_code = COALESCE($11, zip_code),
                  tax_id = COALESCE($12, tax_id),
                  notes = COALESCE($13, notes),
                  includes_ban = COALESCE($14, includes_ban),
                  updated_at = NOW()
            WHERE id = $15
            RETURNING *`,
                [
                    owner_name, name, business_name, contact_person, email, phone, additional_phone, cellular,
                    address, city, zip_code, tax_id, notes,
                    includes_ban === undefined ? null : Boolean(includes_ban),
                    id
                ]
            );
        }

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando cliente');
    }
};

/**
 * PATCH /api/clients/:id/mark-checked
 * Marca un cliente como "actualizado" con timestamp
 */
export const markClientChecked = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query(
            'UPDATE clients SET last_checked_at = NOW() WHERE id = $1 RETURNING id, last_checked_at',
            [id]
        );
        if (result.length === 0) {
            return notFound(res, 'Cliente');
        }
        res.json({ success: true, last_checked_at: result[0].last_checked_at });
    } catch (error) {
        serverError(res, error, 'Error marcando cliente como actualizado');
    }
};

/**
 * GET /api/clients/check-duplicate?name=NOMBRE
 * Verifica si existe un cliente con el mismo nombre (case-insensitive, trimmed)
 */
export const checkDuplicateClient = async (req, res) => {
    const { name, phone } = req.query;

    if ((!name || String(name).trim() === '') && (!phone || normalizeDigits(phone) === '')) {
        return badRequest(res, 'name o phone es requerido');
    }

    try {
        const existing = await findClientDuplicate({ name, phone });

        res.json({
            exists: Boolean(existing),
            existingName: existing?.name || null,
            existingId: existing?.id || null,
            existingPhone: existing?.phone || existing?.additional_phone || existing?.cellular || null
        });
    } catch (error) {
        serverError(res, error, 'Error verificando duplicado');
    }
};



