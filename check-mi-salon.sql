SELECT c.name, b.status, COUNT(*) as bans
FROM clients c 
JOIN bans b ON c.id = b.client_id 
WHERE c.name = 'MI SALON A Y S CORP'
GROUP BY c.name, b.status;
