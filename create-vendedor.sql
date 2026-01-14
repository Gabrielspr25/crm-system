-- Crear vendedor Carlos López
INSERT INTO salespeople (name, role, created_at, updated_at) 
VALUES ('Carlos López', 'vendedor', NOW(), NOW()) 
RETURNING id, name, role;
