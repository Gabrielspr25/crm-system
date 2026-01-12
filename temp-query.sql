SELECT id, client_id, company_name, is_active, completed_date 
FROM follow_up_prospects 
WHERE COALESCE(is_active, true) = true 
AND completed_date IS NULL 
LIMIT 3;
