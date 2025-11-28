SELECT fp.company_name, fp.total_amount, v.name AS vendor_name, c.name AS client_name, c.business_name AS client_business_name 
FROM follow_up_prospects fp 
LEFT JOIN vendors v ON fp.vendor_id = v.id 
INNER JOIN clients c ON fp.client_id = c.id 
WHERE c.is_active = 1 AND fp.is_completed = true 
ORDER BY fp.completed_date DESC;
