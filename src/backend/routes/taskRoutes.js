import { Router } from 'express';
import {
  authenticateToken, badRequest, notFound, serverError, query,
  ensureSchema, mapRow, mapColRow, SELECT_TASK,
  toDbId, sameId, TASK_STATUSES,
  normalizeTaskDate, normalizeTaskTime, normalizeTaskPriority, normalizeTaskKind,
  normalizeClientTaskWorkflow, normalizeTaskWorkflowSteps, normalizeTaskCustomFields,
  normalizeTaskColumnType, normalizeTaskColumnOptions, cleanTaskColumnKey,
  resolveTaskStatusForWorkflow
} from '../controllers/taskController.js';

const router = Router();

// GET /api/tasks/assignees  (before /:id)
router.get('/assignees', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  try {
    await ensureSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isPriv = role === 'admin' || role === 'supervisor';
    const rows = await query(
      `SELECT u.id::text AS user_id, u.username, COALESCE(s.name, u.username) AS display_name, COALESCE(s.role,'vendedor') AS role
       FROM users_auth u LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
       ${isPriv ? '' : 'WHERE u.id::text = $1'}
       ORDER BY COALESCE(s.name, u.username) ASC`,
      isPriv ? [] : [uid]
    );
    res.json(rows.map(r => ({ user_id: String(r.user_id), username: r.username, display_name: r.display_name, role: String(r.role || 'vendedor').toLowerCase() })));
  } catch (e) { serverError(res, e, 'Error obteniendo asignables'); }
});

// GET /api/tasks/columns
router.get('/columns', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  try {
    await ensureSchema();
    const rows = await query(`SELECT id,column_key,label,data_type,options,sort_order,is_active,created_at,updated_at FROM crm_task_columns WHERE owner_user_id=$1 AND is_active=TRUE ORDER BY sort_order ASC, id ASC`, [uid]);
    res.json(rows.map(mapColRow));
  } catch (e) { serverError(res, e, 'Error obteniendo columnas'); }
});

// GET /api/tasks
router.get('/', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  try {
    await ensureSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isPriv = role === 'admin' || role === 'supervisor';
    const conds = [], params = [];
    if (!isPriv) { params.push(uid); conds.push(`(t.owner_user_id=$${params.length} OR t.assigned_user_id=$${params.length})`); }
    const rawStatus = typeof req.query?.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    if (TASK_STATUSES.has(rawStatus)) { conds.push(`t.status=$${params.length+1}`); params.push(rawStatus); }
    const assignedTo = String(req.query?.assigned_to || '').trim();
    if (isPriv && assignedTo && assignedTo.toLowerCase() !== 'all') { conds.push(`t.assigned_user_id=$${params.length+1}`); params.push(String(toDbId(assignedTo))); }
    const q = String(req.query?.q || '').trim();
    if (q) { conds.push(`(t.title ILIKE $${params.length+1} OR COALESCE(t.client_name,'') ILIKE $${params.length+1} OR COALESCE(t.notes,'') ILIKE $${params.length+1})`); params.push(`%${q}%`); }
    const cid = req.query?.client_id;
    if (cid !== undefined && cid !== null && String(cid).trim() !== '') { conds.push(`t.client_id::text=$${params.length+1}`); params.push(String(cid).trim()); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await query(`${SELECT_TASK} ${where} ORDER BY CASE t.status WHEN 'done' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END, t.due_date ASC NULLS LAST, t.created_at DESC`, params);
    res.json(rows.map(mapRow));
  } catch (e) { serverError(res, e, 'Error obteniendo tareas'); }
});

// POST /api/tasks
router.post('/', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  const title = String(req.body?.title || '').trim();
  if (!title) return badRequest(res, 'El titulo es obligatorio');
  const role = String(req.user?.role || '').toLowerCase();
  const isPriv = role === 'admin' || role === 'supervisor';
  const notes = String(req.body?.notes || '').trim() || null;
  const wf = normalizeTaskWorkflowSteps(req.body?.workflow_steps);
  const kind = normalizeTaskKind(req.body?.task_kind, { clientTaskWorkflow: req.body?.client_task_workflow, workflowSteps: wf, notes });
  const status = resolveTaskStatusForWorkflow(kind, wf, req.body?.status);
  let cid = null;
  if (req.body?.client_id != null && req.body?.client_id !== '') cid = req.body.client_id;
  const cname = String(req.body?.client_name || '').trim() || null;
  if (kind === 'client' && (!cid || !cname)) return badRequest(res, 'Las tareas de cliente requieren cliente valido');
  let assignedUid = uid;
  if (req.body?.assigned_user_id != null && req.body?.assigned_user_id !== '') assignedUid = String(toDbId(req.body.assigned_user_id));
  if (!isPriv && !sameId(assignedUid, uid)) return res.status(403).json({ error: 'Sin permiso para asignar a otros' });
  try {
    await ensureSchema();
    const check = await query(`SELECT id::text FROM users_auth WHERE id::text=$1`, [assignedUid]);
    if (!check.length) return badRequest(res, 'Usuario asignado no existe');
    const rows = await query(
      `INSERT INTO crm_tasks (owner_user_id,assigned_user_id,title,due_date,follow_up_date,follow_up_time,client_id,client_name,notes,status,priority,task_kind,client_task_workflow,workflow_steps,custom_fields,completed_at,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,CASE WHEN $10='done' THEN NOW() ELSE NULL END,NOW(),NOW())
       RETURNING *`,
      [uid, assignedUid, title, normalizeTaskDate(req.body?.due_date), normalizeTaskDate(req.body?.follow_up_date), normalizeTaskTime(req.body?.follow_up_time),
       cid, cname, notes, status, normalizeTaskPriority(req.body?.priority), kind,
       kind === 'client' ? normalizeClientTaskWorkflow(req.body?.client_task_workflow) : null,
       JSON.stringify(wf), JSON.stringify(normalizeTaskCustomFields(req.body?.custom_fields))]
    );
    res.status(201).json(mapRow(rows[0]));
  } catch (e) { serverError(res, e, 'Error creando tarea'); }
});

// PUT /api/tasks/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  const tid = Number(req.params.id);
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  if (Number.isNaN(tid)) return badRequest(res, 'ID invalido');
  const role = String(req.user?.role || '').toLowerCase();
  const isPriv = role === 'admin' || role === 'supervisor';
  try {
    await ensureSchema();
    const cur = await query(`SELECT * FROM crm_tasks WHERE id=$1 ${isPriv ? '' : 'AND (owner_user_id=$2 OR assigned_user_id=$2)'}`, isPriv ? [tid] : [tid, uid]);
    if (!cur.length) return notFound(res, 'Tarea');
    const c = cur[0];
    const upd = [], vals = []; let idx = 1;
    const has = k => Object.prototype.hasOwnProperty.call(req.body || {}, k);
    const nextWf = has('workflow_steps') ? normalizeTaskWorkflowSteps(req.body.workflow_steps) : normalizeTaskWorkflowSteps(c.workflow_steps);
    const nextKind = has('task_kind') ? normalizeTaskKind(req.body.task_kind, { clientTaskWorkflow: has('client_task_workflow') ? req.body.client_task_workflow : c.client_task_workflow, workflowSteps: nextWf, notes: has('notes') ? req.body.notes : c.notes }) : normalizeTaskKind(c.task_kind, { clientTaskWorkflow: c.client_task_workflow, workflowSteps: nextWf, notes: c.notes });
    const reqStatus = has('status') ? req.body.status : c.status;
    const effStatus = resolveTaskStatusForWorkflow(nextKind, nextWf, reqStatus);
    const fields = ['title','due_date','follow_up_date','follow_up_time','client_name','client_id','notes','priority'];
    for (const f of fields) {
      if (!has(f)) continue;
      let v = req.body[f];
      if (f === 'due_date' || f === 'follow_up_date') v = normalizeTaskDate(v);
      else if (f === 'follow_up_time') v = normalizeTaskTime(v);
      else if (f === 'priority') v = normalizeTaskPriority(v);
      else if (f === 'title') { v = String(v || '').trim(); if (!v) return badRequest(res, 'Titulo vacio'); }
      else if (f === 'client_name') v = String(v || '').trim() || null;
      else if (f === 'client_id') v = (v === null || v === '') ? null : v;
      else if (f === 'notes') v = String(v || '').trim() || null;
      upd.push(`${f}=$${idx++}`); vals.push(v);
    }
    if (has('assigned_user_id')) {
      let auid = req.body.assigned_user_id != null && req.body.assigned_user_id !== '' ? String(toDbId(req.body.assigned_user_id)) : uid;
      if (!isPriv && !sameId(auid, uid)) return res.status(403).json({ error: 'Sin permiso' });
      upd.push(`assigned_user_id=$${idx++}`); vals.push(auid);
    }
    if (has('task_kind') || has('workflow_steps')) { upd.push(`task_kind=$${idx++}`); vals.push(nextKind); }
    if (has('client_task_workflow')) { upd.push(`client_task_workflow=$${idx++}`); vals.push(nextKind === 'client' ? normalizeClientTaskWorkflow(req.body.client_task_workflow) : null); }
    if (has('workflow_steps')) { upd.push(`workflow_steps=$${idx++}::jsonb`); vals.push(JSON.stringify(nextWf)); }
    if (has('custom_fields')) { upd.push(`custom_fields=$${idx++}::jsonb`); vals.push(JSON.stringify(normalizeTaskCustomFields(req.body.custom_fields))); }
    upd.push(`status=$${idx++}`); vals.push(effStatus);
    if (effStatus === 'done') upd.push(`completed_at=COALESCE(completed_at,NOW())`);
    else upd.push(`completed_at=NULL`);
    upd.push('updated_at=NOW()');
    if (!upd.length) return badRequest(res, 'Sin campos');
    vals.push(tid);
    if (!isPriv) vals.push(uid);
    const rows = await query(`UPDATE crm_tasks SET ${upd.join(',')} WHERE id=$${idx} ${isPriv ? '' : `AND (owner_user_id=$${idx+1} OR assigned_user_id=$${idx+1})`} RETURNING *`, vals);
    if (!rows.length) return notFound(res, 'Tarea');
    res.json(mapRow(rows[0]));
  } catch (e) { serverError(res, e, 'Error actualizando tarea'); }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  const tid = Number(req.params.id);
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  if (Number.isNaN(tid)) return badRequest(res, 'ID invalido');
  try {
    await ensureSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isPriv = role === 'admin' || role === 'supervisor';
    const rows = await query(`DELETE FROM crm_tasks WHERE id=$1 ${isPriv ? '' : 'AND owner_user_id=$2'} RETURNING id`, isPriv ? [tid] : [tid, uid]);
    if (!rows.length) return notFound(res, 'Tarea');
    res.json({ success: true });
  } catch (e) { serverError(res, e, 'Error eliminando tarea'); }
});

// POST /api/tasks/columns
router.post('/columns', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  const label = String(req.body?.label || '').trim();
  if (!label) return badRequest(res, 'Nombre de columna obligatorio');
  try {
    await ensureSchema();
    let key = cleanTaskColumnKey(req.body?.column_key || label);
    if (!key) return badRequest(res, 'Nombre de columna invalido');
    let suffix = 1;
    while (true) {
      const ex = await query(`SELECT 1 FROM crm_task_columns WHERE owner_user_id=$1 AND column_key=$2 LIMIT 1`, [uid, key]);
      if (!ex.length) break;
      key = `${cleanTaskColumnKey(req.body?.column_key || label)}_${++suffix}`;
    }
    const ord = await query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM crm_task_columns WHERE owner_user_id=$1`, [uid]);
    const rows = await query(`INSERT INTO crm_task_columns (owner_user_id,column_key,label,data_type,options,sort_order,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,TRUE,NOW(),NOW()) RETURNING *`,
      [uid, key, label, normalizeTaskColumnType(req.body?.data_type), JSON.stringify(normalizeTaskColumnOptions(req.body?.options)), Number(ord[0]?.n ?? 0)]);
    res.status(201).json(mapColRow(rows[0]));
  } catch (e) { serverError(res, e, 'Error creando columna'); }
});

// PUT /api/tasks/columns/:id
router.put('/columns/:id', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  const cid = Number(req.params.id);
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  if (Number.isNaN(cid)) return badRequest(res, 'ID invalido');
  const upd = [], vals = [uid, cid]; let i = 3;
  const has = k => Object.prototype.hasOwnProperty.call(req.body || {}, k);
  if (has('label')) { const l = String(req.body.label || '').trim(); if (!l) return badRequest(res, 'Nombre vacio'); upd.push(`label=$${i++}`); vals.push(l); }
  if (has('data_type')) { upd.push(`data_type=$${i++}`); vals.push(normalizeTaskColumnType(req.body.data_type)); }
  if (has('sort_order')) { upd.push(`sort_order=$${i++}`); vals.push(Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0); }
  if (has('is_active')) { upd.push(`is_active=$${i++}`); vals.push(Boolean(req.body.is_active)); }
  if (has('options')) { upd.push(`options=$${i++}::jsonb`); vals.push(JSON.stringify(normalizeTaskColumnOptions(req.body.options))); }
  if (!upd.length) return badRequest(res, 'Sin campos');
  upd.push('updated_at=NOW()');
  try {
    await ensureSchema();
    const rows = await query(`UPDATE crm_task_columns SET ${upd.join(',')} WHERE owner_user_id=$1 AND id=$2 RETURNING *`, vals);
    if (!rows.length) return notFound(res, 'Columna');
    res.json(mapColRow(rows[0]));
  } catch (e) { serverError(res, e, 'Error actualizando columna'); }
});

// DELETE /api/tasks/columns/:id
router.delete('/columns/:id', authenticateToken, async (req, res) => {
  const uid = String(req.user?.userId || '').trim();
  const cid = Number(req.params.id);
  if (!uid) return res.status(401).json({ error: 'Sesion invalida' });
  if (Number.isNaN(cid)) return badRequest(res, 'ID invalido');
  try {
    await ensureSchema();
    const rows = await query(`DELETE FROM crm_task_columns WHERE owner_user_id=$1 AND id=$2 RETURNING column_key`, [uid, cid]);
    if (!rows.length) return notFound(res, 'Columna');
    await query(`UPDATE crm_tasks SET custom_fields=custom_fields-$2, updated_at=NOW() WHERE owner_user_id=$1`, [uid, rows[0].column_key]);
    res.json({ success: true });
  } catch (e) { serverError(res, e, 'Error eliminando columna'); }
});

export default router;
