-- Crear sales_report para prospecto 22
INSERT INTO sales_reports (follow_up_prospect_id, client_id, vendor_id, company_name, total_amount, sale_date)
VALUES (22, 29745, 14, 'ORTIZ KITCHEN MFG INC', 149.99, '2025-11-27 17:50:37');

-- Actualizar product_goals para Fijo Nueva (vendor_id IS NULL = meta negocio)
UPDATE product_goals 
SET current_revenue = current_revenue + 149.99
WHERE product_id = (SELECT id FROM products WHERE name = 'Fijo Nueva')
  AND vendor_id IS NULL
  AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND period_month = EXTRACT(MONTH FROM CURRENT_DATE);

-- Actualizar product_goals para Fijo Nueva (vendor_id = 14 = meta vendedor)
UPDATE product_goals 
SET current_revenue = current_revenue + 149.99
WHERE product_id = (SELECT id FROM products WHERE name = 'Fijo Nueva')
  AND vendor_id = 14
  AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND period_month = EXTRACT(MONTH FROM CURRENT_DATE);
