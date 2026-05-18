import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

const FOLLOWING_VISIBLE_NAME_SQL = `
    COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NOT NULL
`;
const FOLLOWING_VALID_CLIENT_SQL = `
    fp.client_id IS NOT NULL
    AND ${FOLLOWING_VISIBLE_NAME_SQL}
    AND EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
`;

export const FOLLOWUP_DIAGNOSTIC_SQL = {
    active_without_client: `
        SELECT fp.id, fp.client_id, fp.company_name, fp.is_active, fp.completed_date
        FROM follow_up_prospects fp
        WHERE fp.completed_date IS NULL
          AND COALESCE(fp.is_active::text, 'true') IN ('true', '1', 't')
          AND (fp.client_id IS NULL OR TRIM(CAST(fp.client_id AS text)) = '')
        ORDER BY fp.created_at DESC
    `,
    active_without_visible_name: `
        SELECT fp.id, fp.client_id, fp.company_name, c.name AS client_name, c.business_name
        FROM follow_up_prospects fp
        JOIN clients c ON c.id = fp.client_id
        WHERE fp.completed_date IS NULL
          AND COALESCE(fp.is_active::text, 'true') IN ('true', '1', 't')
          AND COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NULL
        ORDER BY fp.created_at DESC
    `,
    active_without_ban: `
        SELECT fp.id, fp.client_id, fp.company_name, c.name AS client_name, c.business_name
        FROM follow_up_prospects fp
        JOIN clients c ON c.id = fp.client_id
        WHERE fp.completed_date IS NULL
          AND COALESCE(fp.is_active::text, 'true') IN ('true', '1', 't')
          AND COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
        ORDER BY fp.created_at DESC
    `
};

const FOLLOW_UP_NOTE_COLUMNS = `
    fn.id,
    fn.follow_up_id,
    fn.client_id,
    fn.deal_id,
    fn.note,
    fn.created_by,
    fn.created_by_name,
    fn.created_at,
    fn.updated_at
`;

let followUpNotesReadyPromise = null;

const ensureFollowUpNotesReady = async () => {
    if (!followUpNotesReadyPromise) {
        followUpNotesReadyPromise = (async () => {
            await query(`
                CREATE TABLE IF NOT EXISTS follow_up_notes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    follow_up_id INTEGER NOT NULL,
                    client_id UUID NOT NULL,
                    deal_id UUID NULL,
                    note TEXT NOT NULL,
                    created_by UUID NULL,
                    created_by_name TEXT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await query(`CREATE INDEX IF NOT EXISTS idx_follow_up_notes_follow_up_id ON follow_up_notes (follow_up_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_follow_up_notes_client_id ON follow_up_notes (client_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_follow_up_notes_created_at_desc ON follow_up_notes (created_at DESC)`);

            await query(`
                WITH legacy_notes AS (
                    SELECT
                        fp.id AS follow_up_id,
                        fp.client_id,
                        NULL::uuid AS deal_id,
                        TRIM(fp.notes) AS note,
                        NULL::uuid AS created_by,
                        'Sistema'::text AS created_by_name,
                        COALESCE(fp.updated_at, fp.created_at, NOW()) AS created_at,
                        COALESCE(fp.updated_at, fp.created_at, NOW()) AS updated_at
                    FROM follow_up_prospects fp
                    WHERE fp.client_id IS NOT NULL
                      AND fp.notes IS NOT NULL
                      AND TRIM(fp.notes) <> ''
                )
                INSERT INTO follow_up_notes (
                    follow_up_id,
                    client_id,
                    deal_id,
                    note,
                    created_by,
                    created_by_name,
                    created_at,
                    updated_at
                )
                SELECT
                    l.follow_up_id,
                    l.client_id,
                    l.deal_id,
                    l.note,
                    l.created_by,
                    l.created_by_name,
                    l.created_at,
                    l.updated_at
                FROM legacy_notes l
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM follow_up_notes fn
                    WHERE fn.follow_up_id = l.follow_up_id
                      AND fn.client_id = l.client_id
                      AND fn.note = l.note
                      AND COALESCE(fn.created_by_name, '') = 'Sistema'
                )
            `);
        })().catch((error) => {
            followUpNotesReadyPromise = null;
            throw error;
        });
    }

    return followUpNotesReadyPromise;
};

const loadLastNoteSql = `
    LEFT JOIN LATERAL (
        SELECT fn.note, fn.created_at, fn.created_by_name
        FROM follow_up_notes fn
        WHERE fn.follow_up_id = fp.id
        ORDER BY fn.created_at DESC, fn.id DESC
        LIMIT 1
    ) last_note ON TRUE
`;

const loadLastNoteFieldsSql = `
    CASE
        WHEN last_note.note IS NULL THEN NULL
        ELSE jsonb_build_object(
            'text', last_note.note,
            'at', last_note.created_at,
            'author', last_note.created_by_name
        )
    END AS last_note
`;

const sameSalesperson = (left, right) => String(left || '').trim() === String(right || '').trim();

const resolveFollowUpAccess = async (followUpId, reqUser) => {
    const rows = await query(
        `
            SELECT fp.id, fp.client_id, fp.vendor_id, c.salesperson_id AS client_salesperson_id
            FROM follow_up_prospects fp
            LEFT JOIN clients c ON c.id = fp.client_id
            WHERE fp.id = $1
            LIMIT 1
        `,
        [followUpId]
    );

    if (rows.length === 0) {
        return { found: false, row: null, allowed: false };
    }

    const row = rows[0];
    const role = String(reqUser?.role || '').trim().toLowerCase();
    const salespersonId = String(reqUser?.salespersonId || '').trim();

    if (role === 'vendedor') {
        if (!salespersonId) {
            return { found: true, row, allowed: false };
        }

        const clientSalespersonId = String(row.client_salesperson_id || '').trim();
        if (clientSalespersonId && sameSalesperson(clientSalespersonId, salespersonId)) {
            return { found: true, row, allowed: true };
        }

        const vendorRows = await query(
            'SELECT id FROM vendors WHERE salesperson_id::text = $1 LIMIT 1',
            [salespersonId]
        ).catch(() => []);
        const vendorId = vendorRows[0]?.id ? String(vendorRows[0].id).trim() : '';
        const prospectVendorId = String(row.vendor_id || '').trim();

        if (!vendorId || !prospectVendorId || !sameSalesperson(prospectVendorId, vendorId)) {
            return { found: true, row, allowed: false };
        }
    }

    return { found: true, row, allowed: true };
};

export const getFollowUpProspects = async (req, res) => {
    try {
        const { role, salespersonId } = req.user || {};
        if (role === 'vendedor' && !salespersonId) {
            return res.json([]);
        }
        await ensureFollowUpNotesReady();
        const conditions = [];
        const params = [];
        if (role === 'vendedor' && salespersonId) {
            const idx = params.length + 1;
            conditions.push(`c.salesperson_id = $${idx}`);
            params.push(salespersonId);
        }
        conditions.push(FOLLOWING_VALID_CLIENT_SQL);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        let prospects;
        try {
            prospects = await query(
                `SELECT fp.*, c.name as client_name, v.name as vendor_name, ps.name as step_name, NULL::text as step_color, pp.name as priority_name, pp.color_hex as priority_color,
                  ${loadLastNoteFieldsSql},
                  (SELECT t.step_name FROM crm_deals d JOIN crm_deal_tasks t ON t.deal_id = d.id
                   WHERE d.client_id::text = fp.client_id::text AND t.status = 'in_progress'
                   ORDER BY d.created_at DESC, t.step_order ASC LIMIT 1) AS current_step_name,
                  (SELECT t.due_date FROM crm_deals d JOIN crm_deal_tasks t ON t.deal_id = d.id
                   WHERE d.client_id::text = fp.client_id::text AND t.status = 'in_progress'
                   ORDER BY d.created_at DESC, t.step_order ASC LIMIT 1) AS current_due_date
           FROM follow_up_prospects fp
           JOIN clients c ON fp.client_id = c.id
           LEFT JOIN vendors v ON fp.vendor_id = v.id
           LEFT JOIN follow_up_steps ps ON fp.step_id = ps.id
           LEFT JOIN priorities pp ON fp.priority_id = pp.id
           ${loadLastNoteSql}
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
                        NULL::text as priority_name, NULL::text as priority_color,
                        ${loadLastNoteFieldsSql},
                        (SELECT t.step_name FROM crm_deals d JOIN crm_deal_tasks t ON t.deal_id = d.id
                         WHERE d.client_id::text = fp.client_id::text AND t.status = 'in_progress'
                         ORDER BY d.created_at DESC, t.step_order ASC LIMIT 1) AS current_step_name,
                        (SELECT t.due_date FROM crm_deals d JOIN crm_deal_tasks t ON t.deal_id = d.id
                         WHERE d.client_id::text = fp.client_id::text AND t.status = 'in_progress'
                         ORDER BY d.created_at DESC, t.step_order ASC LIMIT 1) AS current_due_date
                   FROM follow_up_prospects fp
                   JOIN clients c ON fp.client_id = c.id
                   LEFT JOIN vendors v ON fp.vendor_id = v.id
                   ${loadLastNoteSql}
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

export const getFollowUpNotes = async (req, res) => {
    const followUpId = String(req.params.id || '').trim();
    if (!followUpId) {
        return badRequest(res, 'follow_up_id es obligatorio');
    }

    try {
        await ensureFollowUpNotesReady();
        const access = await resolveFollowUpAccess(followUpId, req.user);
        if (!access.found) {
            return notFound(res, 'Prospecto');
        }
        if (!access.allowed) {
            return res.status(403).json({ error: 'No tienes acceso a este seguimiento' });
        }

        const rows = await query(
            `
                SELECT ${FOLLOW_UP_NOTE_COLUMNS}
                FROM follow_up_notes fn
                WHERE fn.follow_up_id = $1
                ORDER BY fn.created_at DESC, fn.id DESC
            `,
            [followUpId]
        );

        res.json(rows);
    } catch (error) {
        serverError(res, error, 'Error obteniendo notas del seguimiento');
    }
};

export const createFollowUpNote = async (req, res) => {
    const followUpId = String(req.params.id || '').trim();
    const note = String(req.body?.note || '').trim();
    const dealId = req.body?.deal_id == null || String(req.body?.deal_id).trim() === ''
        ? null
        : String(req.body.deal_id).trim();

    if (!followUpId) {
        return badRequest(res, 'follow_up_id es obligatorio');
    }
    if (!note) {
        return badRequest(res, 'La nota no puede estar vacía');
    }

    try {
        await ensureFollowUpNotesReady();
        const access = await resolveFollowUpAccess(followUpId, req.user);
        if (!access.found) {
            return notFound(res, 'Prospecto');
        }
        if (!access.allowed) {
            return res.status(403).json({ error: 'No tienes acceso a este seguimiento' });
        }
        if (!access.row?.client_id) {
            return badRequest(res, 'El seguimiento no tiene cliente asociado');
        }

        const createdBy = req.user?.salespersonId ? String(req.user.salespersonId).trim() : null;
        const createdByName = String(req.user?.salespersonName || req.user?.username || 'Sistema').trim() || 'Sistema';

        const inserted = await query(
            `
                INSERT INTO follow_up_notes (
                    follow_up_id,
                    client_id,
                    deal_id,
                    note,
                    created_by,
                    created_by_name,
                    created_at,
                    updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING
                    id,
                    follow_up_id,
                    client_id,
                    deal_id,
                    note,
                    created_by,
                    created_by_name,
                    created_at,
                    updated_at
            `,
            [
                followUpId,
                access.row.client_id,
                dealId,
                note,
                createdBy,
                createdByName
            ]
        );

        await query(
            `UPDATE follow_up_prospects
                SET updated_at = NOW()
              WHERE id = $1`,
            [followUpId]
        );

        res.status(201).json(inserted[0]);
    } catch (error) {
        serverError(res, error, 'Error guardando nota del seguimiento');
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
