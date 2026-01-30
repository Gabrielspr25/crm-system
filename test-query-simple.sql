-- Test query simplificado
SELECT 
  fup.id,
  fup.completed_date,
  fup.client_id,
  c.name as client_name,
  COALESCE(sp.name, v.name) as vendor_name,
  COALESCE(sp.id::text, v.id::text) as vendor_id
FROM follow_up_prospects fup
LEFT JOIN clients c ON fup.client_id = c.id
LEFT JOIN vendors v ON fup.vendor_id = v.id
LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
WHERE fup.completed_date IS NOT NULL
ORDER BY fup.completed_date DESC;
