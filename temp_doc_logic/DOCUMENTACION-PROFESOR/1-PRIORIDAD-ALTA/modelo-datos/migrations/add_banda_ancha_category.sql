-- Agregar categoría Banda Ancha
INSERT INTO plan_categories (name, code, description, icon, color, display_order, is_active)
VALUES ('BANDA ANCHA - Internet Móvil', 'BANDA_ANCHA', 'Internet móvil con modem portátil', 'wifi', 'purple', 2, true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Verificar categorías
SELECT id, name, code, description, display_order FROM plan_categories ORDER BY display_order;
