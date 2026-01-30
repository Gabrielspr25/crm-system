-- Migración: Sistema de tiers FIJO con duración de contrato

-- 1. Crear tabla commission_tiers_fijo
CREATE TABLE IF NOT EXISTS commission_tiers_fijo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    contract_duration INTEGER NOT NULL, -- 24, 12, 0 (sin contrato)
    multiplier NUMERIC(5,2) NOT NULL, -- 3.30, 2.1, 1.1
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, contract_duration)
);

-- 2. Agregar campos de duración a follow_up_prospects
ALTER TABLE follow_up_prospects 
ADD COLUMN IF NOT EXISTS fijo_new_duration INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS fijo_ren_duration INTEGER DEFAULT 24;

-- 3. Insertar tiers default para Fijo New
INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier)
SELECT id, 24, 3.30 FROM products WHERE name = 'Fijo New'
ON CONFLICT (product_id, contract_duration) DO NOTHING;

INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier)
SELECT id, 12, 2.1 FROM products WHERE name = 'Fijo New'
ON CONFLICT (product_id, contract_duration) DO NOTHING;

INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier)
SELECT id, 0, 1.1 FROM products WHERE name = 'Fijo New'
ON CONFLICT (product_id, contract_duration) DO NOTHING;

-- 4. Insertar tiers default para Fijo Ren
INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier)
SELECT id, 24, 3.30 FROM products WHERE name = 'Fijo Ren'
ON CONFLICT (product_id, contract_duration) DO NOTHING;

INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier)
SELECT id, 12, 2.1 FROM products WHERE name = 'Fijo Ren'
ON CONFLICT (product_id, contract_duration) DO NOTHING;

INSERT INTO commission_tiers_fijo (product_id, contract_duration, multiplier)
SELECT id, 0, 1.1 FROM products WHERE name = 'Fijo Ren'
ON CONFLICT (product_id, contract_duration) DO NOTHING;

-- 5. Crear índices
CREATE INDEX IF NOT EXISTS idx_tiers_fijo_product ON commission_tiers_fijo(product_id);

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_tiers_fijo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tiers_fijo_updated_at
BEFORE UPDATE ON commission_tiers_fijo
FOR EACH ROW
EXECUTE FUNCTION update_tiers_fijo_updated_at();
