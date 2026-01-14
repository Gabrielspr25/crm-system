-- Crear acceso al sistema para los 4 vendedores legacy
BEGIN;

-- 1. ANEUDY
INSERT INTO salespeople (id, name, email, role, created_at, updated_at)
VALUES (gen_random_uuid(), 'ANEUDY', null, 'vendedor', NOW(), NOW())
RETURNING id \gset aneudy_

INSERT INTO users_auth (username, password, salesperson_id, created_at)
VALUES ('aneudy', '$2b$10$jKSDMG4uxYlbYnIBx5/.xe2xckiv0OFugKVEknQTF3wB25l8NoxMG', :'aneudy_id', NOW());

-- 2. DAYANA
INSERT INTO salespeople (id, name, email, role, created_at, updated_at)
VALUES (gen_random_uuid(), 'DAYANA', 'dayana@empresa.com', 'vendedor', NOW(), NOW())
RETURNING id \gset dayana_

INSERT INTO users_auth (username, password, salesperson_id, created_at)
VALUES ('dayana', '$2b$10$tvqQNDTyU93z8KrbYBhKkuCThJUao93AP9AjlLI5IHZCVhk.T0tju', :'dayana_id', NOW());

-- 3. HERNAN
INSERT INTO salespeople (id, name, email, role, created_at, updated_at)
VALUES (gen_random_uuid(), 'HERNAN', 'hernan@empresa.com', 'vendedor', NOW(), NOW())
RETURNING id \gset hernan_

INSERT INTO users_auth (username, password, salesperson_id, created_at)
VALUES ('hernan', '$2b$10$8YUFH1Ax2RGQ2Yt8UfzQ..KOxsEIkNSm2rV.hChzzds/PTYb1LXHu', :'hernan_id', NOW());

-- 4. RANDY
INSERT INTO salespeople (id, name, email, role, created_at, updated_at)
VALUES (gen_random_uuid(), 'RANDY', 'randy@empresa.com', 'vendedor', NOW(), NOW())
RETURNING id \gset randy_

INSERT INTO users_auth (username, password, salesperson_id, created_at)
VALUES ('randy', '$2b$10$1bQEQ.OHHlcE9DArWUFKTeX5uVEsw6FPNzpwX97NGwDFnOv2aUvZi', :'randy_id', NOW());

COMMIT;

-- Verificar que se crearon correctamente
SELECT u.username, s.name, s.role, s.email
FROM users_auth u
JOIN salespeople s ON u.salesperson_id = s.id
WHERE u.username IN ('aneudy', 'dayana', 'hernan', 'randy')
ORDER BY u.username;
