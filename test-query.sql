SELECT p.id, p.company_name, p.is_active, c.name as client_name
FROM follow_up_prospects p
JOIN clients c ON p.client_id = c.id
WHERE p.is_active = true
LIMIT 5;
