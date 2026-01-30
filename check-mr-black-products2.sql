SELECT 
  id,
  client_id,
  movil_nueva,
  movil_renovacion
FROM follow_up_prospects 
WHERE client_id IN (SELECT id FROM clients WHERE name = 'MR BLACK INC')
AND completed_date IS NOT NULL;
