import { query } from '../database/db.js';

// Mi Día — base = clientes en seguimiento (follow_up_prospects + clients).
// crm_deal_tasks NO es la base: solo se usa con LEFT JOIN LATERAL para traer
// la task más relevante por cliente si existe. Si no hay task → badge='sin_tarea';
// si hay task sin due_date → 'sin_fecha'; si no → 'atrasado' / 'hoy' / 'futuro'.
const SQL = `
  WITH base_followups AS (
    SELECT
      p.id            AS follow_up_id,
      p.client_id,
      c.name          AS client_name,
      c.business_name,
      c.salesperson_id
    FROM follow_up_prospects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.completed_date IS NULL
      AND c.id IS NOT NULL
      AND TRIM(COALESCE(c.name, c.business_name, '')) <> ''
      AND LOWER(TRIM(COALESCE(c.name, c.business_name, ''))) NOT IN ('sin nombre','null','none','undefined')
      AND ($1::text IS NULL OR c.salesperson_id::text = $1::text)
  )
  SELECT
    bf.follow_up_id,
    bf.client_id::text                                                          AS client_id,
    COALESCE(NULLIF(TRIM(bf.client_name), ''), NULLIF(TRIM(bf.business_name), '')) AS client_name,
    bf.salesperson_id::text                                                     AS salesperson_id,
    task.task_id,
    task.step_name,
    task.task_status,
    task.due_date::text                                                         AS due_date,
    task.ban_number,
    task.phone,
    task.product_type,
    CASE
      WHEN task.task_id IS NULL              THEN 'sin_tarea'
      WHEN task.due_date IS NULL             THEN 'sin_fecha'
      WHEN task.due_date::date < CURRENT_DATE THEN 'atrasado'
      WHEN task.due_date::date = CURRENT_DATE THEN 'hoy'
      ELSE                                        'futuro'
    END                                                                         AS badge
  FROM base_followups bf
  LEFT JOIN LATERAL (
    SELECT
      t.id             AS task_id,
      t.step_name,
      t.status         AS task_status,
      t.due_date,
      b.ban_number,
      s.phone,
      d.product_type
    FROM crm_deals d
    JOIN crm_deal_tasks t ON t.deal_id = d.id
    LEFT JOIN subscribers s ON s.id::text = d.subscriber_id
    LEFT JOIN bans b       ON b.id = s.ban_id
    WHERE d.client_id::text = bf.client_id::text
      AND t.status IN ('in_progress', 'pending')
    ORDER BY
      CASE WHEN t.status = 'in_progress' THEN 0 ELSE 1 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
      t.due_date     DESC NULLS LAST,
      t.step_order   ASC  NULLS LAST,
      t.created_at   DESC
    LIMIT 1
  ) task ON true
  WHERE COALESCE(NULLIF(TRIM(bf.client_name), ''), NULLIF(TRIM(bf.business_name), '')) IS NOT NULL
  ORDER BY
    CASE
      WHEN task.due_date IS NOT NULL AND task.due_date::date < CURRENT_DATE THEN 0
      WHEN task.due_date IS NOT NULL AND task.due_date::date = CURRENT_DATE THEN 1
      WHEN task.due_date IS NOT NULL AND task.due_date::date > CURRENT_DATE THEN 2
      WHEN task.task_id IS NULL                                              THEN 3
      ELSE                                                                        4
    END,
    task.due_date ASC NULLS LAST,
    client_name   ASC
`;

export const getMyDay = async (req, res) => {
  try {
    const userRole = String(req.user?.role || '').trim().toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'supervisor';
    const requestedSellerId = req.query?.seller_id
      ? String(req.query.seller_id).trim()
      : null;
    const ownSalespersonId = String(req.user?.salespersonId || '').trim() || null;

    // Filtro vendedor:
    // - vendedor: siempre su propio salesperson_id (si no tiene → vacío)
    // - admin/supervisor: respeta seller_id si está; sino TODOS (sin filtro)
    let sellerFilter;
    if (isAdmin) {
      sellerFilter = requestedSellerId || null;
    } else {
      sellerFilter = ownSalespersonId;
      if (!sellerFilter) {
        return res.json([]);
      }
    }

    const rows = await query(SQL, [sellerFilter]);
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('[myDayController] error:', err);
    return res.status(500).json({ error: 'Error obteniendo Mi Día' });
  }
};
