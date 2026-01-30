-- Actualizar categorías para usar nomenclatura de Claro
UPDATE plan_categories SET name = '1 PLAY - Telefonía Fija', code = '1PLAY', description = 'Solo telefonía fija' WHERE id = 2;
UPDATE plan_categories SET name = '2 PLAY - Internet + Voz', code = '2PLAY', description = 'Internet + Telefonía fija' WHERE id = 3;
UPDATE plan_categories SET name = '3 PLAY - Internet + Voz + TV', code = '3PLAY', description = 'Internet + Voz + TV' WHERE id = 5;
UPDATE plan_categories SET name = 'CLARO TV', code = 'TV', description = 'Televisión por cable' WHERE id = 4;

-- Verificar cambios
SELECT id, name, code, description FROM plan_categories ORDER BY id;
