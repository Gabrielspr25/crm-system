import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

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
