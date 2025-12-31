-- Crear tabla de reportes/ventas completadas
CREATE TABLE sales_reports (
  id SERIAL PRIMARY KEY,
  follow_up_prospect_id INTEGER NOT NULL REFERENCES follow_up_prospects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  sale_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sales_reports_client ON sales_reports(client_id);
CREATE INDEX idx_sales_reports_vendor ON sales_reports(vendor_id);
CREATE INDEX idx_sales_reports_sale_date ON sales_reports(sale_date);
