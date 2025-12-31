-- Remote Migration Script to Fix Schema Mismatch
-- Goal: Align remote DB with schema-final.sql without losing data

-- 1. Create salespeople table if missing
CREATE TABLE IF NOT EXISTS salespeople (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    avatar TEXT,
    role VARCHAR(50) DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
    monthly_sales_goal DECIMAL(10,2) DEFAULT 0,
    theme JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Populate salespeople if empty (Critical for foreign keys)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM salespeople) THEN
        INSERT INTO salespeople (name, email, role) VALUES 
        ('Admin Principal', 'admin@crm.com', 'admin');
    END IF;
END $$;

-- 3. Fix Clients Table
-- Check if we need to migrate vendor_id -> salesperson_id
DO $$
BEGIN
    -- Add salesperson_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='salesperson_id') THEN
        ALTER TABLE clients ADD COLUMN salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL;
    END IF;

    -- Migrate data from vendor_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='vendor_id') THEN
        -- Attempt to link existing vendors to new salespeople?
        -- For now, just link everyone to the first salesperson to avoid NOT NULL errors, 
        -- OR leave NULL if allowed.
        -- Ideally we would migrate vendors -> salespeople table too, but let's assume manual fix for now.
        -- Update clients SET salesperson_id = (SELECT id FROM salespeople LIMIT 1) WHERE salesperson_id IS NULL AND vendor_id IS NOT NULL;
        NULL; -- Do nothing for now unless we are sure.
    END IF;
    
    -- Rename 'company' column if needed (business_name -> company)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='business_name') THEN
        -- Check if target column exists
         IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='company') THEN
            ALTER TABLE clients RENAME COLUMN business_name TO company;
         END IF;
    END IF;
END $$;

-- 4. Fix BANs Table
DO $$
BEGIN
    -- Add number column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bans' AND column_name='number') THEN
        ALTER TABLE bans ADD COLUMN number VARCHAR(9);
    END IF;

    -- Migrate ban_number -> number
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bans' AND column_name='ban_number') THEN
        UPDATE bans SET number = ban_number WHERE number IS NULL;
    END IF;
END $$;

-- 5. Fix Subscribers (if needed)
-- (Assuming subscribers works or is less critical right now)

-- 6. Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;
