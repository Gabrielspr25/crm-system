SELECT s.id, s.phone, s.service_type, s.ban_id, b.ban_number 
FROM subscribers s 
LEFT JOIN bans b ON s.ban_id = b.id 
WHERE s.phone LIKE '%699805535%';