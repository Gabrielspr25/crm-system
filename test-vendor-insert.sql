-- Probar INSERT exactamente como lo hace el controller
INSERT INTO vendors (name, email, is_active, created_at) 
VALUES ('TEST VENDOR', null, 1, NOW()) 
RETURNING *;
