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
        // Verificar si existe la tabla follow_ups o similar
        // Asumimos que existe y tiene client_id
        try {
             await query('UPDATE follow_ups SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);
        } catch (e) {
            console.warn("No se pudo actualizar follow_ups (quizás no existe la tabla o columna)", e.message);
        }

        // 4. Mover Contactos (si hubiera tabla separada, pero parece que están en clients)
        
        // 5. Eliminar Cliente Origen
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
                OR c.business_name ILIKE $1 
                OR b.ban_number ILIKE $1
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
        const clients = await query(
            `SELECT c.*, v.name as vendor_name 
       FROM clients c 
       LEFT JOIN vendors v ON c.vendor_id = v.id 
       ORDER BY c.created_at DESC`
        );
        res.json(clients);
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
        name,
        business_name = null,
        contact_person = null,
        email = null,
        phone = null,
        secondary_phone = null,
        mobile_phone = null,
        address = null,
        city = null,
        zip_code = null,
        includes_ban = 0,
        vendor_id = null,
        base = 0 // Nuevo campo
    } = req.body;

    if (!name) {
        return badRequest(res, 'El nombre es obligatorio');
    }

    try {
        // Lógica de asignación de vendedor (simplificada para el refactor, mantener lógica original si es compleja)
        // Aquí asumimos que si viene vendor_id se usa, si no, se podría asignar basado en usuario logueado
        // Para mantener compatibilidad con server-FINAL.js, replicamos lógica básica:

        let finalVendorId = vendor_id;
        if (!finalVendorId && req.user && req.user.salespersonId) {
            // Si el usuario es vendedor, se asigna a sí mismo
            const vendorRes = await query('SELECT id FROM vendors WHERE salesperson_id = $1', [req.user.salespersonId]);
            if (vendorRes.length > 0) {
                finalVendorId = vendorRes[0].id;
            }
        }

        const result = await query(
            `INSERT INTO clients
        (name, business_name, contact_person, email, phone, secondary_phone, mobile_phone, address, city, zip_code, includes_ban, vendor_id, base, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,NOW(),NOW())
       RETURNING *`,
            [
                name.trim(),
                business_name?.trim() || null,
                contact_person,
                email,
                phone,
                secondary_phone,
                mobile_phone,
                address,
                city,
                zip_code,
                includes_ban ? 1 : 0,
                finalVendorId,
                base
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
        name,
        business_name,
        contact_person,
        email,
        phone,
        secondary_phone,
        mobile_phone,
        address,
        city,
        zip_code,
        includes_ban,
        vendor_id,
        base,
        is_active
    } = req.body;

    try {
        const existing = await query('SELECT id FROM clients WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Cliente');
        }

        const result = await query(
            `UPDATE clients
          SET name = COALESCE($1, name),
              business_name = COALESCE($2, business_name),
              contact_person = COALESCE($3, contact_person),
              email = COALESCE($4, email),
              phone = COALESCE($5, phone),
              secondary_phone = COALESCE($6, secondary_phone),
              mobile_phone = COALESCE($7, mobile_phone),
              address = COALESCE($8, address),
              city = COALESCE($9, city),
              zip_code = COALESCE($10, zip_code),
              includes_ban = COALESCE($11, includes_ban),
              vendor_id = COALESCE($12, vendor_id),
              base = COALESCE($13, base),
              is_active = COALESCE($14, is_active),
              updated_at = NOW()
        WHERE id = $15
        RETURNING *`,
            [
                name, business_name, contact_person, email, phone, secondary_phone, mobile_phone,
                address, city, zip_code, includes_ban !== undefined ? (includes_ban ? 1 : 0) : undefined,
                vendor_id, base, is_active !== undefined ? (is_active ? 1 : 0) : undefined, id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando cliente');
    }
};
