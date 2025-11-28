-- Consulta que usa el endpoint con include_completed
SELECT fp.id, fp.company_name, fp.is_completed, v.name AS vendor_name, c.name AS client_name, c.business_name AS client_business_name
FROM follow_up_prospects fp
LEFT JOIN vendors v ON fp.vendor_id = v.id
INNER JOIN clients c ON fp.client_id = c.id
WHERE c.is_active = 1 AND COALESCE(fp.is_active, 1) = 1
ORDER BY fp.created_at DESC;
