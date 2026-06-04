-- Oportunidades V2 - templates de pasos propios
-- Tabla nueva. No usa category_steps ni tablas legacy.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS opportunity_step_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
  product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  opportunity_type TEXT NULL,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  default_due_days INTEGER NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT opportunity_step_templates_type_chk CHECK (
    opportunity_type IS NULL
    OR opportunity_type IN ('renovacion', 'nueva_linea', 'internet', 'upgrade', 'manual', 'mixta')
  ),
  CONSTRAINT opportunity_step_templates_order_chk CHECK (step_order > 0),
  CONSTRAINT opportunity_step_templates_due_chk CHECK (
    default_due_days IS NULL OR default_due_days >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_opportunity_step_templates_category
  ON opportunity_step_templates(category_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_step_templates_product
  ON opportunity_step_templates(product_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_step_templates_active
  ON opportunity_step_templates(category_id, product_id, opportunity_type, step_order)
  WHERE is_active = TRUE;

COMMIT;
