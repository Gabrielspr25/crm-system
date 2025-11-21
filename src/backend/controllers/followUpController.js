import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

export const getFollowUpProspects = async (req, res) => {
    try {
        const prospects = await query(
            `SELECT fp.*, c.name as client_name, v.name as vendor_name, ps.name as step_name, ps.color as step_color, pp.name as priority_name, pp.color as priority_color
       FROM follow_up_prospects fp
       LEFT JOIN clients c ON fp.client_id = c.id
       LEFT JOIN vendors v ON fp.vendor_id = v.id
       LEFT JOIN pipeline_steps ps ON fp.step_id = ps.id
       LEFT JOIN prospect_priorities pp ON fp.priority_id = pp.id
       ORDER BY fp.created_at DESC`
        );
        res.json(prospects);
    } catch (error) {
        serverError(res, error, 'Error obteniendo prospectos');
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
                is_completed ? 1 : 0,
                completed_date,
                total_amount,
                notes,
                contact_phone,
                contact_email,
                base,
                is_active ? 1 : 0
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
        const existing = await query('SELECT id FROM follow_up_prospects WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Prospecto');
        }

        // Construir query dinámica para UPDATE
        // (Simplificado para el ejemplo, idealmente usar una función helper o ORM)
        const result = await query(
            `UPDATE follow_up_prospects
          SET company_name = COALESCE($1, company_name),
              client_id = COALESCE($2, client_id),
              priority_id = COALESCE($3, priority_id),
              vendor_id = COALESCE($4, vendor_id),
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
                company_name, client_id, priority_id, vendor_id, step_id,
                fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls,
                last_call_date, next_call_date, call_count,
                is_completed !== undefined ? (is_completed ? 1 : 0) : undefined,
                completed_date, total_amount, notes, contact_phone, contact_email, base,
                is_active !== undefined ? (is_active ? 1 : 0) : undefined,
                id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando prospecto');
    }
};
