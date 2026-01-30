-- ===============================================
-- AGREGAR COLUMNA commission_percentage SI NO EXISTE
-- ===============================================

-- Agregar columna commission_percentage a products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(10,2);

-- ===============================================
-- CONFIGURAR PORCENTAJES DE COMISIÓN EN PRODUCTOS
-- ===============================================

-- FIJO NUEVO: Empresa gana 3.2% del valor mensual
UPDATE products 
SET commission_percentage = 3.2
WHERE LOWER(name) LIKE '%fijo%new%' 
   OR LOWER(name) LIKE '%fijo%nuevo%';

-- FIJO RENOVACION: Empresa gana 1.6% del valor mensual  
UPDATE products 
SET commission_percentage = 1.6
WHERE LOWER(name) LIKE '%fijo%ren%' 
   OR LOWER(name) LIKE '%fijo%renovacion%';

-- CLARO TV: Empresa gana 100% del valor mensual
UPDATE products 
SET commission_percentage = 100
WHERE LOWER(name) LIKE '%claro%tv%' 
   OR LOWER(name) LIKE '%tv%';

-- CLOUD: Empresa gana 100% del valor mensual
UPDATE products 
SET commission_percentage = 100
WHERE LOWER(name) LIKE '%cloud%';

-- MPLS: Empresa gana 100% del valor mensual
UPDATE products 
SET commission_percentage = 100
WHERE LOWER(name) LIKE '%mpls%';

-- ===============================================
-- VERIFICACION
-- ===============================================
SELECT 
    name,
    commission_percentage,
    CASE 
        WHEN commission_percentage IS NULL THEN 'SIN CONFIGURAR'
        ELSE 'CONFIGURADO'
    END as status
FROM products
ORDER BY name;
