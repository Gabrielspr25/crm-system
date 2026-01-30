-- Ver productos actuales
SELECT id, name, commission_percentage FROM products ORDER BY name;

-- Si los nombres no coinciden, actualizar manualmente:
-- Ejemplo si el producto se llama "Fijo Nuevo" en lugar de "Fijo New":
-- UPDATE products SET commission_percentage = 3.2 WHERE name = 'Fijo Nuevo';
-- UPDATE products SET commission_percentage = 1.6 WHERE name = 'Fijo Renovacion';
