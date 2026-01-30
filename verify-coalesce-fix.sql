SELECT 
  fup.id, 
  c.name as cliente,
  fup.vendor_id as fup_vendor_id,
  v.id as v_id,
  sp.id::text as sp_id,
  COALESCE(v.id::text, sp.id::text) as vendor_id_corregido,
  v.commission_percentage
FROM follow_up_prospects fup
LEFT JOIN clients c ON fup.client_id = c.id
LEFT JOIN vendors v ON fup.vendor_id = v.id
LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
WHERE fup.completed_date IS NOT NULL
AND c.name = 'FERRETERIA COMERCIAL';
