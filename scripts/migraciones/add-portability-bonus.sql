-- ============================================================================
-- Migración: agregar campo portability_bonus a subscriber_reports
-- Fecha: 2026-05-01
-- Motivo: Mapear venta.bonoportabilidad de Tango sin mezclarlo con
--         company_earnings (que sigue siendo solo comisionclaro).
-- Idempotente: usa IF NOT EXISTS.
-- ============================================================================

ALTER TABLE subscriber_reports
  ADD COLUMN IF NOT EXISTS portability_bonus NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN subscriber_reports.portability_bonus IS
  'Bono de portabilidad pagado por Claro (mapea Tango.venta.bonoportabilidad). NO suma a company_earnings ni afecta vendor_commission.';

-- Índice parcial para reportes de bonos pagados
CREATE INDEX IF NOT EXISTS idx_subscriber_reports_portability
  ON subscriber_reports(portability_bonus)
  WHERE portability_bonus > 0;

-- Verificación
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='subscriber_reports' AND column_name='portability_bonus') AS column_exists,
  (SELECT COUNT(*) FROM pg_indexes
   WHERE tablename='subscriber_reports' AND indexname='idx_subscriber_reports_portability') AS index_exists;
