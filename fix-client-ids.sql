UPDATE follow_up_prospects p 
SET client_id = c.id 
FROM clients c 
WHERE p.company_name = c.name 
  AND p.client_id IS NULL;

SELECT COUNT(*) as updated FROM follow_up_prospects WHERE client_id IS NOT NULL;
