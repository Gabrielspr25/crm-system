-- Agregar campos de Activación (Jack) a la tabla plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS activation_0m DECIMAL(10,2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS activation_12m DECIMAL(10,2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS activation_24m DECIMAL(10,2) DEFAULT 0;

-- Agregar comentarios para documentación
COMMENT ON COLUMN plans.activation_0m IS 'Costo de activación sin contrato (Jack 0 meses)';
COMMENT ON COLUMN plans.activation_12m IS 'Costo de activación con contrato 12 meses (Jack 12m)';
COMMENT ON COLUMN plans.activation_24m IS 'Costo de activación con contrato 24 meses (Jack 24m)';

-- Verificar estructura
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'plans' 
  AND column_name LIKE '%activation%'
ORDER BY ordinal_position;
