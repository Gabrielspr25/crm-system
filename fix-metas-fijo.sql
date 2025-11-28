-- Corregir Fijo Renovación que tiene valor negativo
UPDATE product_goals 
SET current_revenue = 0 
WHERE product_id = (SELECT id FROM products WHERE name = 'Fijo Renovación') 
  AND vendor_id = 12 
  AND period_year = 2025 
  AND period_month = 11;

-- Verificar el resultado
SELECT p.name, pg.vendor_id, pg.current_revenue, pg.target_revenue
FROM product_goals pg 
JOIN products p ON pg.product_id = p.id 
WHERE pg.period_year = 2025 AND pg.period_month = 11 
  AND p.name LIKE 'Fijo%'
ORDER BY p.name, pg.vendor_id;
