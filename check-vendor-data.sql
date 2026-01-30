-- Ver datos completos del prospect de FERRETERIA
SELECT 
  fup.id,
  c.name as cliente,
  v.id as vendor_id,
  v.name as vendor_name,
  v.commission_percentage as vendor_pct,
  sp.id as salesperson_id,
  sp.name as salesperson_name
FROM follow_up_prospects fup
JOIN clients c ON fup.client_id = c.id
LEFT JOIN vendors v ON fup.vendor_id = v.id
LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
WHERE c.name LIKE '%FERRETERIA%'
  AND fup.completed_date IS NOT NULL;
