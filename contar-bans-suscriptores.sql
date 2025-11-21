-- Contar BANs únicos y suscriptores
SELECT 
    'BANs únicos' as concepto,
    COUNT(DISTINCT ban_number) as total
FROM bans
WHERE is_active = 1

UNION ALL

SELECT 
    'Total BANs (registros)' as concepto,
    COUNT(*) as total
FROM bans
WHERE is_active = 1

UNION ALL

SELECT 
    'Total suscriptores' as concepto,
    COUNT(*) as total
FROM subscribers
WHERE is_active = 1

UNION ALL

SELECT 
    'Suscriptores activos con contrato' as concepto,
    COUNT(*) as total
FROM subscribers
WHERE is_active = 1 
  AND contract_end_date IS NOT NULL;
