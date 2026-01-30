
CREATE TABLE product_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  total_target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_product_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_goal_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  assigned_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_goals_period ON product_goals(product_id, period_year, period_month);
CREATE INDEX idx_vendor_product_goals_lookup ON vendor_product_goals(product_goal_id, vendor_id);
