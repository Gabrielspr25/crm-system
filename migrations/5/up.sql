-- Migración 5: Sistema de tiers para FIJO con duraciones de contrato

-- Crear tabla de tiers fijo
CREATE TABLE IF NOT EXISTS commission_tiers_fijo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    contract_duration INTEGER NOT NULL, -- 24, 12, 0 (sin contrato)
    multiplier NUMERIC(5,2) NOT NULL, -- 3.30, 2.1, 1.1
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_product_duration UNIQUE (product_id, contract_duration)
);

-- Agregar columnas de duración a follow_up_prospects
ALTER TABLE follow_up_prospects 
ADD COLUMN IF NOT EXISTS fijo_new_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fijo_ren_duration INTEGER DEFAULT 0;

-- Comentarios
COMMENT ON TABLE commission_tiers_fijo IS 'Tiers de comisiones para productos FIJO según duración de contrato';
COMMENT ON COLUMN commission_tiers_fijo.contract_duration IS '24 meses, 12 meses, o 0 (sin contrato)';
COMMENT ON COLUMN commission_tiers_fijo.multiplier IS 'Multiplicador de comisión empresa (ej: 3.30 = 330% del pago)';

-- Insertar tiers iniciales para Fijo New (asumiendo product_id conocido, ajustar después)
-- SELECT id FROM products WHERE name = 'Fijo New'; -- ejecutar primero para obtener UUID
-- INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier) VALUES 
-- ('<UUID_FIJO_NEW>', 24, 3.30),
-- ('<UUID_FIJO_NEW>', 12, 2.10),
-- ('<UUID_FIJO_NEW>', 0, 1.10);
