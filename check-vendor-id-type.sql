SELECT 
  fup.id, 
  c.name as cliente, 
  fup.vendor_id,
  v.id as vendor_table_id,
  v.name as vendor_name,
  v.commission_percentage,
  COALESCE(sp.id::text, v.id::text) as vendor_id_coalesce,
  pg_typeof(fup.vendor_id) as vendor_id_type,
  pg_typeof(v.id) as vendor_table_id_type
FROM follow_up_prospects fup
LEFT JOIN clients c ON fup.client_id = c.id
LEFT JOIN vendors v ON fup.vendor_id = v.id
LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
WHERE fup.completed_date IS NOT NULL
LIMIT 5;
