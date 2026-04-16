import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

export const getFollowUpProspects = async (req, res) => {
    try {
        const { role, salespersonId } = req.user || {};
        if (role === 'vendedor' && !salespersonId) {
            return res.json([]);
        }
        const conditions = [];
        const params = [];
        if (role === 'vendedor' && salespersonId) {
            const idx = params.length + 1;
            conditions.push(`c.salesperson_id = $${idx}`);
            params.push(salespersonId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        let prospects;
        try {
            prospects = await query(
                `SELECT fp.*, c.name as client_name, v.name as vendor_name, ps.name as step_name, NULL::text as step_color, pp.name as priority_name, pp.color_hex as priority_color
           FROM follow_up_prospects fp
           LEFT JOIN clients c ON fp.client_id = c.id
           LEFT JOIN vendors v ON fp.vendor_id = v.id
           LEFT JOIN follow_up_steps ps ON fp.step_id = ps.id
           LEFT JOIN priorities pp ON fp.priority_id = pp.id
           ${whereClause}
           ORDER BY fp.created_at DESC`,
                params
            );
        } catch (error) {
            if (error?.code !== '42P01') throw error;
            console.warn('[follow-up] Fallback sin joins de pasos/prioridades:', error?.message || error);
            prospects = await query(
                `SELECT fp.*, c.name as client_name, v.name as vendor_name,
                        NULL::text as step_name, NULL::text as step_color,
                        NULL::text as priority_name, NULL::text as priority_color
                   FROM follow_up_prospects fp
                   LEFT JOIN clients c ON fp.client_id = c.id
                   LEFT JOIN vendors v ON fp.vendor_id = v.id
                   ${whereClause}
                   ORDER BY fp.created_at DESC`,
                params
            );
        }
        res.json(prospects);
    } catch (error) {
        serverError(res, error, 'Error obteniendo prospectos');
    }
};

export const getFollowUpSteps = async (req, res) => {
    try {
        let steps;
        try {
            steps = await query(`
                SELECT id, name, description, order_index, is_active, created_at, updated_at
                FROM follow_up_steps
                ORDER BY order_index ASC
            `);
        } catch (error) {
            if (error?.code !== '42P01') throw error;
            steps = await query('SELECT * FROM pipeline_steps ORDER BY order_index ASC');
        }
        res.json(steps);
    } catch (error) {
        serverError(res, error, 'Error obteniendo pasos del pipeline');
    }
};

export const createFollowUpProspect = async (req, res) => {
    const {
        company_name,
        client_id = null,
        priority_id = null,
        vendor_id = null,
        step_id = null,
        fijo_ren = 0,
        fijo_new = 0,
        movil_nueva = 0,
        movil_renovacion = 0,
        claro_tv = 0,
        cloud = 0,
        mpls = 0,
        last_call_date = null,
        next_call_date = null,
        call_count = 0,
        is_completed = false,
        completed_date = null,
        total_amount = 0,
        notes = null,
        contact_phone = null,
        contact_email = null,
        base = 0,
        is_active = true
    } = req.body;

    if (!company_name) {
        return badRequest(res, 'El nombre de la empresa es obligatorio');
    }

    try {
        let finalVendorId = vendor_id;
        if (!finalVendorId && req.user && req.user.salespersonId) {
            const vendorRes = await query('SELECT id FROM vendors WHERE salesperson_id = $1', [req.user.salespersonId]);
            if (vendorRes.length > 0) {
                finalVendorId = vendorRes[0].id;
            }
        }
        if (!finalVendorId) {
            return badRequest(res, 'Vendedor obligatorio. No se puede crear un prospecto sin vendedor.');
        }

        const result = await query(
            `INSERT INTO follow_up_prospects
        (company_name, client_id, priority_id, vendor_id, step_id, fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls, last_call_date, next_call_date, call_count, is_completed, completed_date, total_amount, notes, contact_phone, contact_email, base, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
       RETURNING *`,
            [
                company_name.trim(),
                client_id,
                priority_id,
                finalVendorId,
                step_id,
                fijo_ren,
                fijo_new,
                movil_nueva,
                movil_renovacion,
                claro_tv,
                cloud,
                mpls,
                last_call_date,
                next_call_date,
                call_count,
                Boolean(is_completed),
                completed_date,
                total_amount,
                notes,
                contact_phone,
                contact_email,
                base,
                Boolean(is_active)
            ]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando prospecto');
    }
};

export const updateFollowUpProspect = async (req, res) => {
    const { id } = req.params;
    const {
        company_name,
        client_id,
        priority_id,
        vendor_id,
        step_id,
        fijo_ren,
        fijo_new,
        movil_nueva,
        movil_renovacion,
        claro_tv,
        cloud,
        mpls,
        last_call_date,
        next_call_date,
        call_count,
        is_completed,
        completed_date,
        total_amount,
        notes,
        contact_phone,
        contact_email,
        base,
        is_active
    } = req.body;

    try {
        const existing = await query('SELECT id, vendor_id FROM follow_up_prospects WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Prospecto');
        }

        let finalVendorId = vendor_id ?? existing[0].vendor_id ?? null;
        if (!finalVendorId && req.user && req.user.salespersonId) {
            const vendorRes = await query('SELECT id FROM vendors WHERE salesperson_id = $1', [req.user.salespersonId]);
            if (vendorRes.length > 0) {
                finalVendorId = vendorRes[0].id;
            }
        }
        if (!finalVendorId) {
            return badRequest(res, 'Vendedor obligatorio. No se puede guardar un prospecto sin vendedor.');
        }

        // Construir query dinámica para UPDATE
        // (Simplificado para el ejemplo, idealmente usar una función helper o ORM)
        const result = await query(
            `UPDATE follow_up_prospects
          SET company_name = COALESCE($1, company_name),
              client_id = COALESCE($2, client_id),
              priority_id = COALESCE($3, priority_id),
              vendor_id = $4,
              step_id = COALESCE($5, step_id),
              fijo_ren = COALESCE($6, fijo_ren),
              fijo_new = COALESCE($7, fijo_new),
              movil_nueva = COALESCE($8, movil_nueva),
              movil_renovacion = COALESCE($9, movil_renovacion),
              claro_tv = COALESCE($10, claro_tv),
              cloud = COALESCE($11, cloud),
              mpls = COALESCE($12, mpls),
              last_call_date = COALESCE($13, last_call_date),
              next_call_date = COALESCE($14, next_call_date),
              call_count = COALESCE($15, call_count),
              is_completed = COALESCE($16, is_completed),
              completed_date = COALESCE($17, completed_date),
              total_amount = COALESCE($18, total_amount),
              notes = COALESCE($19, notes),
              contact_phone = COALESCE($20, contact_phone),
              contact_email = COALESCE($21, contact_email),
              base = COALESCE($22, base),
              is_active = COALESCE($23, is_active),
              updated_at = NOW()
        WHERE id = $24
        RETURNING *`,
            [
                company_name, client_id, priority_id, finalVendorId, step_id,
                fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls,
                last_call_date, next_call_date, call_count,
                is_completed !== undefined ? Boolean(is_completed) : undefined,
                completed_date, total_amount, notes, contact_phone, contact_email, base,
                is_active !== undefined ? Boolean(is_active) : undefined,
                id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando prospecto');
    }
};

export const returnFollowUpProspect = async (req, res) => {
    const { id } = req.params;
    const { note = null } = req.body || {};

    try {
        const existing = await query(
            'SELECT id, notes, client_id FROM follow_up_prospects WHERE id = $1',
            [id]
        );
        if (existing.length === 0) {
            return notFound(res, 'Prospecto');
        }

        let mergedNotes = existing[0].notes;
        if (typeof note === 'string' && note.trim()) {
            const marker = `--- DEVUELTO A POOL ---\n${note.trim()}`;
            mergedNotes = mergedNotes ? `${mergedNotes}\n\n${marker}` : marker;
        }

        const result = await query(
            `UPDATE follow_up_prospects
                SET is_active = FALSE,
                    notes = COALESCE($1, notes),
                    updated_at = NOW()
              WHERE id = $2
              RETURNING *`,
            [mergedNotes, id]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error devolviendo prospecto al pool');
    }
};
