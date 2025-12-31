-- Verificar si el BAN 823205294 existe en la BD
SELECT 
    b.id,
    b.ban_number,
    b.client_id,
    b.is_active,
    b.status,
    c.id as client_id,
    c.name as client_name,
    c.business_name as client_business_name
FROM bans b
LEFT JOIN clients c ON b.client_id = c.id
WHERE b.ban_number = '823205294';

-- También verificar si hay BANs similares
SELECT 
    b.id,
    b.ban_number,
    b.client_id,
    c.business_name
FROM bans b
LEFT JOIN clients c ON b.client_id = c.id
WHERE b.ban_number LIKE '%823205294%'
   OR b.ban_number LIKE '%82320529%'
ORDER BY b.ban_number;



