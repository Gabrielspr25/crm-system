-- Ver tiers de Movil Ren
SELECT 
  p.name,
  ct.range_min,
  ct.range_max,
  ct.commission_amount
FROM commission_tiers ct
JOIN products p ON ct.product_id = p.id
WHERE p.name ILIKE '%movil%ren%'
ORDER BY ct.range_min;
