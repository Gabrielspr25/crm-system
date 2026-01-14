-- Crear tabla de tiers de comisión
CREATE TABLE IF NOT EXISTS product_commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    range_min DECIMAL(10,2) NOT NULL,
    range_max DECIMAL(10,2),
    commission_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT check_range CHECK (range_min >= 0),
    CONSTRAINT check_commission CHECK (commission_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tiers_product ON product_commission_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_tiers_range ON product_commission_tiers(product_id, range_min, range_max);

-- Insertar tiers para Movil New (MÓVIL NUEVA)
INSERT INTO product_commission_tiers (product_id, range_min, range_max, commission_amount) VALUES
('69819de8-53ba-4553-8a1a-01c2b24f1f42', 0.00, 19.99, 61.20),
('69819de8-53ba-4553-8a1a-01c2b24f1f42', 20.00, 29.99, 91.80),
('69819de8-53ba-4553-8a1a-01c2b24f1f42', 30.00, 39.99, 114.75),
('69819de8-53ba-4553-8a1a-01c2b24f1f42', 40.00, 49.99, 130.05),
('69819de8-53ba-4553-8a1a-01c2b24f1f42', 50.00, 59.99, 153.00),
('69819de8-53ba-4553-8a1a-01c2b24f1f42', 60.00, NULL, 160.65);

-- Insertar tiers para Movil Ren (MÓVIL RENOVACIÓN)
INSERT INTO product_commission_tiers (product_id, range_min, range_max, commission_amount) VALUES
('68a2aad0-ee4b-41bc-abfa-eac7a5e40099', 0.00, 19.99, 25.50),
('68a2aad0-ee4b-41bc-abfa-eac7a5e40099', 20.00, 29.99, 42.50),
('68a2aad0-ee4b-41bc-abfa-eac7a5e40099', 30.00, 39.99, 59.50),
('68a2aad0-ee4b-41bc-abfa-eac7a5e40099', 40.00, 49.99, 76.50),
('68a2aad0-ee4b-41bc-abfa-eac7a5e40099', 50.00, 59.99, 93.50),
('68a2aad0-ee4b-41bc-abfa-eac7a5e40099', 60.00, NULL, 110.50);

SELECT 'Tiers creados exitosamente' AS resultado;
