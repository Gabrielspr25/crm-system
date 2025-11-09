
-- Add client_id to follow_up_prospects to link prospects with existing clients
ALTER TABLE follow_up_prospects ADD COLUMN client_id INTEGER;

-- Create sales_history table to track completed sales from prospects
CREATE TABLE sales_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  prospect_id INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  vendor_id INTEGER,
  total_amount REAL NOT NULL,
  fijo_ren REAL DEFAULT 0,
  fijo_new REAL DEFAULT 0,
  movil_nueva REAL DEFAULT 0,
  movil_renovacion REAL DEFAULT 0,
  claro_tv REAL DEFAULT 0,
  cloud REAL DEFAULT 0,
  mpls REAL DEFAULT 0,
  sale_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_history_client_id ON sales_history(client_id);
CREATE INDEX idx_sales_history_sale_date ON sales_history(sale_date);
