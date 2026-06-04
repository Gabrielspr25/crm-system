BEGIN;

WITH active_followups AS (
  SELECT DISTINCT ON (f.client_id)
    f.id AS follow_up_id,
    f.client_id,
    f.company_name,
    f.notes,
    f.fijo_ren,
    f.fijo_new,
    f.movil_renovacion,
    f.movil_nueva,
    f.claro_tv,
    f.cloud,
    f.mpls,
    f.created_at,
    f.updated_at
  FROM follow_up_prospects f
  WHERE f.client_id IS NOT NULL
    AND f.completed_date IS NULL
    AND COALESCE(f.is_active::text, 'true') IN ('true', '1', 't')
  ORDER BY f.client_id, f.updated_at DESC NULLS LAST, f.created_at DESC NULLS LAST, f.id DESC
),
missing AS (
  SELECT af.*, c.salesperson_id, COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), ''), NULLIF(TRIM(af.company_name), ''), 'Sin nombre') AS client_name
  FROM active_followups af
  JOIN clients c ON c.id = af.client_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM sales_opportunities so
    WHERE so.client_id = af.client_id
      AND so.archived_at IS NULL
  )
),
inserted AS (
  INSERT INTO sales_opportunities (
    client_id,
    salesperson_id,
    title,
    description,
    opportunity_type,
    status,
    priority,
    source,
    created_at,
    updated_at
  )
  SELECT
    client_id,
    salesperson_id,
    'SOV2 seguimiento - ' || client_name,
    NULLIF(TRIM(notes), ''),
    'mixta',
    'activa',
    'media',
    'follow_up_prospects',
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW())
  FROM missing
  RETURNING id, client_id
),
source_values AS (
  SELECT
    i.id AS opportunity_id,
    m.client_id,
    product_key,
    product_type,
    sale_type,
    money_value,
    quantity_value
  FROM inserted i
  JOIN missing m ON m.client_id = i.client_id
  CROSS JOIN LATERAL (
    VALUES
      ('fijo_ren', 'FIJO', 'REN', COALESCE(m.fijo_ren, 0)::numeric, NULL::integer),
      ('fijo_new', 'FIJO', 'NEW', COALESCE(m.fijo_new, 0)::numeric, NULL::integer),
      ('movil_ren', 'MOVIL', 'REN', NULL::numeric, COALESCE(m.movil_renovacion, 0)::integer),
      ('movil_new', 'MOVIL', 'NEW', NULL::numeric, COALESCE(m.movil_nueva, 0)::integer),
      ('claro_tv', 'CLARO_TV', 'NEW', NULL::numeric, COALESCE(m.claro_tv, 0)::integer),
      ('cloud', 'CLOUD', 'NEW', NULL::numeric, COALESCE(m.cloud, 0)::integer),
      ('mpls', 'MPLS', 'NEW', COALESCE(m.mpls, 0)::numeric, NULL::integer)
  ) AS p(product_key, product_type, sale_type, money_value, quantity_value)
)
INSERT INTO opportunity_lines (
  opportunity_id,
  client_id,
  line_mode,
  product_key,
  product_type,
  sale_type,
  money_value,
  quantity_value,
  status,
  created_at,
  updated_at
)
SELECT
  opportunity_id,
  client_id,
  'otro',
  product_key,
  product_type,
  sale_type,
  money_value,
  quantity_value,
  'incluida',
  NOW(),
  NOW()
FROM source_values;

COMMIT;
