-- Agregar columna commission_percentage a vendors
-- Cada vendedor tiene un % que cobra de las comisiones

BEGIN;

-- Agregar columna a vendors (nullable para permitir existentes)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 50.00;

-- Actualizar vendors existentes con 50% default
UPDATE vendors 
SET commission_percentage = 50.00 
WHERE commission_percentage IS NULL;

-- Comentar la columna
COMMENT ON COLUMN vendors.commission_percentage IS 'Porcentaje que cobra el vendedor de la comisión calculada (0-100)';

-- Verificar
SELECT id, name, commission_percentage 
FROM vendors 
WHERE is_active = 1 
ORDER BY name;

COMMIT;
