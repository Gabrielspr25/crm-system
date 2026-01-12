-- Verificar qué falta
SELECT 'Categorías actuales:' as info;
SELECT id, name FROM categories ORDER BY name;

SELECT 'Productos actuales:' as info;
SELECT id, name FROM products ORDER BY name;

-- Restaurar productos faltantes
INSERT INTO products (name, category_id, price, monthly_goal) 
SELECT 'Plan Móvil Básico', c.id, 29.99, 100
FROM categories c 
WHERE c.name = 'Móvil'
AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plan Móvil Básico');

INSERT INTO products (name, category_id, price, monthly_goal) 
SELECT 'Plan Móvil Premium', c.id, 59.99, 50
FROM categories c 
WHERE c.name = 'Móvil'
AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plan Móvil Premium');

INSERT INTO products (name, category_id, price, monthly_goal) 
SELECT 'Internet 50MB', c.id, 39.99, 75
FROM categories c 
WHERE c.name = 'Internet'
AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'Internet 50MB');

INSERT INTO products (name, category_id, price, monthly_goal) 
SELECT 'Internet 100MB', c.id, 59.99, 50
FROM categories c 
WHERE c.name = 'Internet'
AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'Internet 100MB');

INSERT INTO products (name, category_id, price, monthly_goal) 
SELECT 'Paquete Empresarial', c.id, 199.99, 10
FROM categories c 
WHERE c.name = 'Empresarial'
AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'Paquete Empresarial');

INSERT INTO products (name, category_id, price, monthly_goal) 
SELECT 'TV Básica', c.id, 24.99, 60
FROM categories c 
WHERE c.name = 'TV'
AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'TV Básica');

-- Verificar resultado
SELECT 'Productos después de restaurar:' as info;
SELECT id, name, category_id FROM products ORDER BY name;
