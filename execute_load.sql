-- Add activation columns
ALTER TABLE plans ADD COLUMN IF NOT EXISTS activation_0m DECIMAL(10,2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS activation_12m DECIMAL(10,2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS activation_24m DECIMAL(10,2) DEFAULT 0;

-- Delete existing plans
DELETE FROM plans;

-- Load plans from file
\i /tmp/load_plans.sql

-- Show count
SELECT COUNT(*) as total_planes FROM plans;
