-- Ver datos completos de FERRETERIA COMERCIAL
SELECT 
  c.name as cliente,
  fup.movil_renovacion as movil_ren_agregado,
  b.ban_number,
  b.account_type,
  s.phone,
  s.monthly_value,
  s.line_type
FROM follow_up_prospects fup
JOIN clients c ON fup.client_id = c.id
JOIN bans b ON b.client_id = c.id
LEFT JOIN subscribers s ON s.ban_id = b.id
WHERE c.name LIKE '%FERRETERIA%'
  AND fup.completed_date IS NOT NULL
ORDER BY b.ban_number, s.phone;
