
-- Tabla de vendedores
CREATE TABLE vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business_name TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  includes_ban BOOLEAN DEFAULT 0,
  vendor_id INTEGER,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de BANs (Billing Account Numbers)
CREATE TABLE bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ban_number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de suscriptores
CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  ban_id INTEGER NOT NULL,
  contract_start_date DATE,
  contract_end_date DATE,
  service_type TEXT,
  monthly_value REAL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de tareas de seguimiento
CREATE TABLE follow_up_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL,
  status TEXT DEFAULT 'prospect',
  priority_order INTEGER DEFAULT 0,
  notes TEXT,
  expected_value REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX idx_clients_vendor_id ON clients(vendor_id);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_bans_client_id ON bans(client_id);
CREATE INDEX idx_bans_ban_number ON bans(ban_number);
CREATE INDEX idx_subscribers_ban_id ON subscribers(ban_id);
CREATE INDEX idx_subscribers_phone ON subscribers(phone);
CREATE INDEX idx_subscribers_contract_end_date ON subscribers(contract_end_date);
CREATE INDEX idx_follow_up_tasks_subscriber_id ON follow_up_tasks(subscriber_id);
CREATE INDEX idx_follow_up_tasks_status ON follow_up_tasks(status);
