
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER,
  period_type TEXT NOT NULL, -- 'monthly', 'quarterly', 'yearly'
  period_year INTEGER NOT NULL,
  period_month INTEGER, -- null for quarterly/yearly
  period_quarter INTEGER, -- null for monthly/yearly
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  color_hex TEXT, -- for UI theming
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER,
  description TEXT,
  base_price REAL,
  commission_percentage REAL,
  is_recurring BOOLEAN DEFAULT 0,
  billing_cycle TEXT, -- 'monthly', 'quarterly', 'yearly'
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goals_vendor_period ON goals(vendor_id, period_type, period_year, period_month, period_quarter);
CREATE INDEX idx_products_category ON products(category_id);
