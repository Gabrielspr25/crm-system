-- Reportes por suscriptor (mensual)
CREATE TABLE IF NOT EXISTS subscriber_reports (
  subscriber_id UUID NOT NULL,
  report_month DATE NOT NULL,
  company_earnings DECIMAL(12, 2),
  vendor_commission DECIMAL(12, 2),
  paid_amount DECIMAL(12, 2),
  paid_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (subscriber_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_reports_month
  ON subscriber_reports (report_month);
