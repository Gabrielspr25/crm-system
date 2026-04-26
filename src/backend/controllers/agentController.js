import { query } from '../database/db.js';

let ensureAgentSchemaPromise = null;

const MEMORY_TYPES = new Set(['analysis', 'recommendation', 'execution', 'context', 'note']);
const DECISION_STATUSES = new Set(['proposed', 'approved', 'rejected', 'executed', 'superseded']);
const TASK_STATUSES = new Set(['pending', 'in_progress', 'done', 'cancelled']);
const TASK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const RUN_STATUSES = new Set(['running', 'success', 'failed', 'cancelled']);

const trimOrNull = (value) => {
    const normalized = String(value ?? '').trim();
    return normalized || null;
};

const trimRequired = (value) => String(value ?? '').trim();

const normalizeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeDate = (value) => {
    const normalized = trimOrNull(value);
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return normalized.slice(0, 10);
};

const pick = (value, allowed, fallback) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return allowed.has(normalized) ? normalized : fallback;
};

export const ensureAgentMemorySchema = async () => {
    if (ensureAgentSchemaPromise) return ensureAgentSchemaPromise;

    ensureAgentSchemaPromise = (async () => {
        await query(`
            CREATE TABLE IF NOT EXISTS agent_memory (
                id BIGSERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                memory_type TEXT NOT NULL DEFAULT 'note',
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source_module TEXT,
                related_client_id TEXT,
                related_ban TEXT,
                importance INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS agent_decisions (
                id BIGSERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                title TEXT NOT NULL,
                decision TEXT NOT NULL,
                reason TEXT,
                impact TEXT,
                status TEXT NOT NULL DEFAULT 'proposed',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS agent_tasks (
                id BIGSERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                priority TEXT NOT NULL DEFAULT 'normal',
                due_date DATE,
                related_client_id TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Auto-migracion: vendedor asignado (TEXT, sin FK por simetria con related_client_id).
        await query(`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS assigned_salesperson_id TEXT`);

        await query(`
            CREATE TABLE IF NOT EXISTS agent_runs (
                id BIGSERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                run_type TEXT NOT NULL,
                input_summary TEXT,
                output_summary TEXT,
                status TEXT NOT NULL DEFAULT 'success',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS agent_memory_agent_created_idx ON agent_memory(agent_name, created_at DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS agent_memory_related_client_idx ON agent_memory(related_client_id)`);
        await query(`CREATE INDEX IF NOT EXISTS agent_memory_related_ban_idx ON agent_memory(related_ban)`);
        await query(`CREATE INDEX IF NOT EXISTS agent_decisions_agent_created_idx ON agent_decisions(agent_name, created_at DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS agent_tasks_status_priority_idx ON agent_tasks(status, priority, created_at DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS agent_tasks_assigned_idx ON agent_tasks(assigned_salesperson_id)`);
        await query(`CREATE INDEX IF NOT EXISTS agent_runs_agent_created_idx ON agent_runs(agent_name, created_at DESC)`);
    })().catch((error) => {
        ensureAgentSchemaPromise = null;
        throw error;
    });

    return ensureAgentSchemaPromise;
};

const listRows = async (table, req, res) => {
    try {
        await ensureAgentMemorySchema();
        const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
        const rows = await query(`SELECT * FROM ${table} ORDER BY created_at DESC, id DESC LIMIT $1`, [limit]);
        res.json(rows);
    } catch (error) {
        console.error(`[agents] Error listando ${table}:`, error);
        res.status(500).json({ error: `Error listando ${table}` });
    }
};

export const getAgentMemory = (req, res) => listRows('agent_memory', req, res);
export const getAgentDecisions = (req, res) => listRows('agent_decisions', req, res);
export const getAgentRuns = (req, res) => listRows('agent_runs', req, res);

/**
 * Lista tareas filtrando por rol del usuario autenticado:
 * - admin/supervisor: ve todas (incluidas las que tienen assigned_salesperson_id NULL).
 * - vendedor: solo las asignadas a su salesperson_id; las que no tienen vendedor quedan ocultas.
 * - vendedor sin salesperson_id mapeado: array vacio (estricto).
 */
export const getAgentTasks = async (req, res) => {
    try {
        await ensureAgentMemorySchema();
        const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);

        const role = String(req.user?.role || '').toLowerCase();
        const isAdmin = role === 'admin' || role === 'supervisor';
        const mySalespersonId = req.user?.salespersonId ? String(req.user.salespersonId) : null;

        let rows;
        if (isAdmin) {
            rows = await query(
                `SELECT * FROM agent_tasks ORDER BY created_at DESC, id DESC LIMIT $1`,
                [limit]
            );
        } else {
            if (!mySalespersonId) {
                return res.json([]);
            }
            rows = await query(
                `SELECT * FROM agent_tasks
                  WHERE assigned_salesperson_id = $1
                  ORDER BY created_at DESC, id DESC
                  LIMIT $2`,
                [mySalespersonId, limit]
            );
        }

        res.json(rows);
    } catch (error) {
        console.error('[agents] Error listando tareas:', error);
        res.status(500).json({ error: 'Error listando tareas de agente' });
    }
};

export const createAgentMemory = async (req, res) => {
    const agentName = trimRequired(req.body?.agent_name);
    const title = trimRequired(req.body?.title);
    const content = trimRequired(req.body?.content);

    if (!agentName || !title || !content) {
        return res.status(400).json({ error: 'agent_name, title y content son obligatorios' });
    }

    try {
        await ensureAgentMemorySchema();
        const rows = await query(
            `INSERT INTO agent_memory
                (agent_name, memory_type, title, content, source_module, related_client_id, related_ban, importance, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
             RETURNING *`,
            [
                agentName,
                pick(req.body?.memory_type, MEMORY_TYPES, 'note'),
                title,
                content,
                trimOrNull(req.body?.source_module),
                trimOrNull(req.body?.related_client_id),
                trimOrNull(req.body?.related_ban),
                normalizeNumber(req.body?.importance, 0)
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[agents] Error creando memoria:', error);
        res.status(500).json({ error: 'Error creando memoria de agente' });
    }
};

export const createAgentDecision = async (req, res) => {
    const agentName = trimRequired(req.body?.agent_name);
    const title = trimRequired(req.body?.title);
    const decision = trimRequired(req.body?.decision);

    if (!agentName || !title || !decision) {
        return res.status(400).json({ error: 'agent_name, title y decision son obligatorios' });
    }

    try {
        await ensureAgentMemorySchema();
        const rows = await query(
            `INSERT INTO agent_decisions
                (agent_name, title, decision, reason, impact, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,NOW())
             RETURNING *`,
            [
                agentName,
                title,
                decision,
                trimOrNull(req.body?.reason),
                trimOrNull(req.body?.impact),
                pick(req.body?.status, DECISION_STATUSES, 'proposed')
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[agents] Error creando decision:', error);
        res.status(500).json({ error: 'Error creando decision de agente' });
    }
};

export const createAgentTask = async (req, res) => {
    const agentName = trimRequired(req.body?.agent_name);
    const title = trimRequired(req.body?.title);

    if (!agentName || !title) {
        return res.status(400).json({ error: 'agent_name y title son obligatorios' });
    }

    try {
        await ensureAgentMemorySchema();
        const rows = await query(
            `INSERT INTO agent_tasks
                (agent_name, title, description, status, priority, due_date, related_client_id, assigned_salesperson_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
             RETURNING *`,
            [
                agentName,
                title,
                trimOrNull(req.body?.description),
                pick(req.body?.status, TASK_STATUSES, 'pending'),
                pick(req.body?.priority, TASK_PRIORITIES, 'normal'),
                normalizeDate(req.body?.due_date),
                trimOrNull(req.body?.related_client_id),
                trimOrNull(req.body?.assigned_salesperson_id)
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[agents] Error creando tarea:', error);
        res.status(500).json({ error: 'Error creando tarea de agente' });
    }
};

export const updateAgentTask = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'ID invalido' });
    }

    const updates = [];
    const values = [];
    let index = 1;
    const has = (field) => Object.prototype.hasOwnProperty.call(req.body || {}, field);

    if (has('title')) {
        const title = trimRequired(req.body.title);
        if (!title) return res.status(400).json({ error: 'title no puede estar vacio' });
        updates.push(`title = $${index++}`);
        values.push(title);
    }
    if (has('description')) {
        updates.push(`description = $${index++}`);
        values.push(trimOrNull(req.body.description));
    }
    if (has('status')) {
        updates.push(`status = $${index++}`);
        values.push(pick(req.body.status, TASK_STATUSES, 'pending'));
    }
    if (has('priority')) {
        updates.push(`priority = $${index++}`);
        values.push(pick(req.body.priority, TASK_PRIORITIES, 'normal'));
    }
    if (has('due_date')) {
        updates.push(`due_date = $${index++}`);
        values.push(normalizeDate(req.body.due_date));
    }
    if (has('related_client_id')) {
        updates.push(`related_client_id = $${index++}`);
        values.push(trimOrNull(req.body.related_client_id));
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Sin campos para actualizar' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    try {
        await ensureAgentMemorySchema();

        // Pre-check de existencia + permisos antes del UPDATE.
        const existing = await query(
            'SELECT id, assigned_salesperson_id FROM agent_tasks WHERE id = $1',
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Tarea de agente no encontrada' });
        }

        const role = String(req.user?.role || '').toLowerCase();
        const isAdmin = role === 'admin' || role === 'supervisor';
        if (!isAdmin) {
            const taskAssigned = existing[0].assigned_salesperson_id
                ? String(existing[0].assigned_salesperson_id)
                : null;
            const mySalespersonId = req.user?.salespersonId
                ? String(req.user.salespersonId)
                : null;
            if (!mySalespersonId || taskAssigned !== mySalespersonId) {
                return res.status(403).json({ error: 'No autorizado para modificar esta tarea' });
            }
        }

        const rows = await query(`UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = $${index} RETURNING *`, values);
        if (rows.length === 0) return res.status(404).json({ error: 'Tarea de agente no encontrada' });
        res.json(rows[0]);
    } catch (error) {
        console.error('[agents] Error actualizando tarea:', error);
        res.status(500).json({ error: 'Error actualizando tarea de agente' });
    }
};

export const createAgentRun = async (req, res) => {
    const agentName = trimRequired(req.body?.agent_name);
    const runType = trimRequired(req.body?.run_type);

    if (!agentName || !runType) {
        return res.status(400).json({ error: 'agent_name y run_type son obligatorios' });
    }

    try {
        await ensureAgentMemorySchema();
        const rows = await query(
            `INSERT INTO agent_runs
                (agent_name, run_type, input_summary, output_summary, status, created_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             RETURNING *`,
            [
                agentName,
                runType,
                trimOrNull(req.body?.input_summary),
                trimOrNull(req.body?.output_summary),
                pick(req.body?.status, RUN_STATUSES, 'success')
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[agents] Error creando run:', error);
        res.status(500).json({ error: 'Error creando ejecucion de agente' });
    }
};
