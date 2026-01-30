CREATE TABLE IF NOT EXISTS commission_tiers_fijo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    contract_duration INTEGER NOT NULL,
    multiplier NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_product_duration UNIQUE (product_id, contract_duration)
);

ALTER TABLE follow_up_prospects 
ADD COLUMN IF NOT EXISTS fijo_new_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fijo_ren_duration INTEGER DEFAULT 0;
