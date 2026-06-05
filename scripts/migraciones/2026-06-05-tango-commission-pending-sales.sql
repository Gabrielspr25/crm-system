-- =====================================================================
-- Migracion: Tango V2 pending commission sales
-- Fecha: 2026-06-05
-- =====================================================================
-- Objetivo:
--   Guardar ventas Tango V2 con comision real que no pueden entrar a
--   subscriber_reports porque falta BAN/suscriptor en CRM.
--
-- Reglas:
--   - No crea clients automaticamente.
--   - No crea bans automaticamente.
--   - No crea subscribers automaticamente.
--   - No duplica por ventaid.
--   - subscriber_reports sigue siendo solo para ventas vinculadas.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tango_commission_pending_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  ventaid BIGINT NOT NULL UNIQUE,

  ban_tango TEXT NULL,
  cliente_tango TEXT NULL,
  telefono_tango TEXT NULL,

  ventatipo_id INTEGER NULL,
  ventatipo_nombre TEXT NULL,
  fecha_activacion DATE NULL,

  company_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_commission NUMERIC(12,2) NOT NULL DEFAULT 0,

  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'linked', 'ignored')),

  linked_client_id UUID NULL REFERENCES clients(id),
  linked_ban_id UUID NULL REFERENCES bans(id),
  linked_subscriber_id UUID NULL REFERENCES subscribers(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tango_pending_status
  ON tango_commission_pending_sales(status);

CREATE INDEX IF NOT EXISTS idx_tango_pending_ban_tango
  ON tango_commission_pending_sales(ban_tango);

CREATE INDEX IF NOT EXISTS idx_tango_pending_fecha_activacion
  ON tango_commission_pending_sales(fecha_activacion);

CREATE INDEX IF NOT EXISTS idx_tango_pending_ventatipo
  ON tango_commission_pending_sales(ventatipo_id);
