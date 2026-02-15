SELECT c.name, c.cellular, 
  (SELECT MIN(s.contract_end_date) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id AND s.contract_end_date IS NOT NULL) as end_date, 
  sp.name as vendor,
  (SELECT s.phone FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id ORDER BY s.contract_end_date ASC NULLS LAST LIMIT 1) as sub_phone
FROM clients c 
LEFT JOIN salespeople sp ON sp.id = c.salesperson_id 
WHERE c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL'
ORDER BY end_date ASC NULLS LAST LIMIT 10;
