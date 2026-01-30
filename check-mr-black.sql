SELECT 
  c.name as cliente,
  s.phone,
  s.monthly_value,
  s.line_type,
  b.account_type
FROM clients c
INNER JOIN bans b ON b.client_id = c.id
INNER JOIN subscribers s ON s.ban_id = b.id
WHERE c.name = 'MR BLACK INC'
ORDER BY s.line_type, s.monthly_value;
