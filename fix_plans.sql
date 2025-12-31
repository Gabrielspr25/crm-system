-- Script para arreglar categorías de planes
-- Ejecuta esto en tu terminal:
-- ssh root@143.244.191.139
-- Luego: su - postgres
-- Luego: psql -d crm_pro
-- Luego copia y pega este SQL:

UPDATE plans 
SET category_id = (SELECT id FROM plan_categories WHERE code = 'FIJO')
WHERE category_id IS NULL;

-- Verificar:
SELECT c.code, c.name, COUNT(p.id) as total
FROM plan_categories c
LEFT JOIN plans p ON p.category_id = c.id
GROUP BY c.id, c.code, c.name
ORDER BY total DESC;
