-- Buscar cliente ZAIDA
SELECT id, name, business_name FROM clients WHERE name ILIKE '%ZAIDA%' OR business_name ILIKE '%ZAIDA%';

-- Ver registros en follow_up_prospects de ZAIDA
SELECT fp.id, fp.company_name, fp.is_completed, fp.completed_date, fp.total_amount, fp.client_id, c.name, c.business_name
FROM follow_up_prospects fp
LEFT JOIN clients c ON fp.client_id = c.id
WHERE c.name ILIKE '%ZAIDA%' OR c.business_name ILIKE '%ZAIDA%' OR fp.company_name ILIKE '%ZAIDA%'
ORDER BY fp.created_at DESC;
