-- SOV2 Fase 1 Backend
-- Modelo oficial: sales_opportunities, opportunity_lines, opportunity_steps.
-- No crea tablas sov2_*.
-- No toca Comisiones, Tango, Mi Dia ni tablas legacy de Pasos/Workflow.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  salesperson_id UUID NULL REFERENCES salespeople(id) ON DELETE SET NULL,
  category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
  product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  opportunity_type TEXT NOT NULL DEFAULT 'manual',
  product_type TEXT NULL,
  sale_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'activa',
  priority TEXT NOT NULL DEFAULT 'media',
  expected_monthly_value NUMERIC(12,2) NULL,
  expected_close_date DATE NULL,
  next_action_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID NULL REFERENCES salespeople(id) ON DELETE SET NULL,
  closed_at TIMESTAMP NULL,
  close_reason TEXT NULL,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_opportunities ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sales_opportunities ADD COLUMN IF NOT EXISTS product_type TEXT NULL;
ALTER TABLE sales_opportunities ADD COLUMN IF NOT EXISTS sale_type TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_opportunities_status_chk'
  ) THEN
    ALTER TABLE sales_opportunities
      ADD CONSTRAINT sales_opportunities_status_chk CHECK (
        status IN ('activa', 'en_progreso', 'ganada', 'perdida', 'pausada', 'cerrada_no_trabajar')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_opportunities_priority_chk'
  ) THEN
    ALTER TABLE sales_opportunities
      ADD CONSTRAINT sales_opportunities_priority_chk CHECK (
        priority IN ('baja', 'media', 'alta', 'critica')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_opportunities_type_chk'
  ) THEN
    ALTER TABLE sales_opportunities
      ADD CONSTRAINT sales_opportunities_type_chk CHECK (
        opportunity_type IN ('renovacion', 'nueva_linea', 'internet', 'upgrade', 'manual', 'mixta')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_client ON sales_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_salesperson ON sales_opportunities(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_status ON sales_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_blocked ON sales_opportunities(blocked);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_next_action ON sales_opportunities(next_action_at);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_active ON sales_opportunities(client_id, status)
  WHERE archived_at IS NULL AND status IN ('activa', 'en_progreso', 'pausada');

CREATE TABLE IF NOT EXISTS opportunity_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ban_id UUID NULL REFERENCES bans(id) ON DELETE SET NULL,
  subscriber_id UUID NULL REFERENCES subscribers(id) ON DELETE SET NULL,
  line_mode TEXT NOT NULL,
  product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
  phone TEXT NULL,
  temp_label TEXT NULL,
  current_plan TEXT NULL,
  target_plan TEXT NULL,
  current_monthly_value NUMERIC(12,2) NULL,
  target_monthly_value NUMERIC(12,2) NULL,
  product_type TEXT NULL,
  sale_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'incluida',
  reason TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE opportunity_lines ADD COLUMN IF NOT EXISTS product_key TEXT NULL;
ALTER TABLE opportunity_lines ADD COLUMN IF NOT EXISTS money_value NUMERIC(12,2) NULL;
ALTER TABLE opportunity_lines ADD COLUMN IF NOT EXISTS quantity_value INTEGER NULL;
ALTER TABLE opportunity_lines ADD COLUMN IF NOT EXISTS product_type TEXT NULL;
ALTER TABLE opportunity_lines ADD COLUMN IF NOT EXISTS sale_type TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_lines_mode_chk'
  ) THEN
    ALTER TABLE opportunity_lines
      ADD CONSTRAINT opportunity_lines_mode_chk CHECK (
        line_mode IN ('existente_renovar', 'nueva_sin_numero', 'upgrade', 'internet', 'otro')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_lines_status_chk'
  ) THEN
    ALTER TABLE opportunity_lines
      ADD CONSTRAINT opportunity_lines_status_chk CHECK (
        status IN ('incluida', 'no_trabajar_ahora', 'excluida', 'ganada', 'perdida')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_lines_product_key_chk'
  ) THEN
    ALTER TABLE opportunity_lines
      ADD CONSTRAINT opportunity_lines_product_key_chk CHECK (
        product_key IS NULL
        OR product_key IN ('fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunity_lines_opportunity ON opportunity_lines(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_lines_client ON opportunity_lines(client_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_lines_subscriber ON opportunity_lines(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_lines_status ON opportunity_lines(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_lines_product_key ON opportunity_lines(product_key);

CREATE TABLE IF NOT EXISTS opportunity_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
  product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  due_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  assigned_to UUID NULL REFERENCES salespeople(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE opportunity_steps ADD COLUMN IF NOT EXISTS line_id UUID NULL REFERENCES opportunity_lines(id) ON DELETE CASCADE;
ALTER TABLE opportunity_steps ADD COLUMN IF NOT EXISTS product_key TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_steps_status_chk'
  ) THEN
    ALTER TABLE opportunity_steps
      ADD CONSTRAINT opportunity_steps_status_chk CHECK (
        status IN ('pendiente', 'en_progreso', 'completado', 'saltado', 'cancelado')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_steps_product_key_chk'
  ) THEN
    ALTER TABLE opportunity_steps
      ADD CONSTRAINT opportunity_steps_product_key_chk CHECK (
        product_key IS NULL
        OR product_key IN ('fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunity_steps_opportunity ON opportunity_steps(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_category ON opportunity_steps(category_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_product ON opportunity_steps(product_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_line ON opportunity_steps(line_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_product_key ON opportunity_steps(product_key);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_assigned ON opportunity_steps(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_due ON opportunity_steps(due_at);
CREATE INDEX IF NOT EXISTS idx_opportunity_steps_open ON opportunity_steps(opportunity_id, status, due_at)
  WHERE status IN ('pendiente', 'en_progreso');

COMMIT;
