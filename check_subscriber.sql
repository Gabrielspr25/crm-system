SELECT s.id, s.phone, s.service_type, s.ban_id, b.ban_number, c.name as client_name
FROM subscribers s
LEFT JOIN bans b ON s.ban_id = b.id
LEFT JOIN clients c ON b.client_id = c.id
WHERE s.phone LIKE '%699805535%';