BEGIN;

CREATE TABLE IF NOT EXISTS opportunity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  product_key TEXT NULL,
  step_id UUID NULL REFERENCES opportunity_steps(id) ON DELETE SET NULL,
  step_name TEXT NULL,
  note TEXT NOT NULL,
  created_by_user_id UUID NULL REFERENCES users_auth(id) ON DELETE SET NULL,
  created_by_username TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunity_notes_product_key_chk CHECK (
    product_key IS NULL
    OR product_key IN ('fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls')
  )
);

CREATE INDEX IF NOT EXISTS idx_opportunity_notes_opportunity_created
  ON opportunity_notes(opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_notes_product_created
  ON opportunity_notes(opportunity_id, product_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON opportunity_notes TO crm_user;

COMMIT;
