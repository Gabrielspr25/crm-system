-- Verificar prospects completados y su info
SELECT 
  fup.id,
  fup.completed_date,
  fup.client_id,
  c.name as client_name,
  c.salesperson_id,
  sp.name as salesperson_name,
  fup.vendor_id,
  v.name as vendor_name
FROM follow_up_prospects fup
LEFT JOIN clients c ON fup.client_id = c.id
LEFT JOIN vendors v ON fup.vendor_id = v.id
LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
WHERE fup.completed_date IS NOT NULL
ORDER BY fup.completed_date DESC;
