
-- Create priorities table for Asana-like priority management
CREATE TABLE priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create steps/actions table for task workflow management
CREATE TABLE follow_up_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create call logs table for tracking all calls
CREATE TABLE call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follow_up_id INTEGER NOT NULL,
  call_date DATETIME NOT NULL,
  notes TEXT,
  outcome TEXT,
  next_call_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create new follow_up_prospects table with the updated structure
CREATE TABLE follow_up_prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  priority_id INTEGER,
  vendor_id INTEGER,
  step_id INTEGER,
  
  -- Product amounts (start at 0, update as negotiated)
  fijo_ren REAL DEFAULT 0,
  fijo_new REAL DEFAULT 0,
  movil_nueva REAL DEFAULT 0,
  movil_renovacion REAL DEFAULT 0,
  claro_tv REAL DEFAULT 0,
  cloud REAL DEFAULT 0,
  mpls REAL DEFAULT 0,
  
  -- Call management
  last_call_date DATETIME,
  next_call_date DATETIME,
  call_count INTEGER DEFAULT 0,
  
  -- Status and completion
  is_completed BOOLEAN DEFAULT 0,
  completed_date DATETIME,
  total_amount REAL DEFAULT 0,
  
  -- Additional info
  notes TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default priorities
INSERT INTO priorities (name, color_hex, order_index) VALUES
('Urgente', '#ef4444', 1),
('Alta', '#f97316', 2),
('Media', '#eab308', 3),
('Baja', '#22c55e', 4);

-- Insert default steps/actions
INSERT INTO follow_up_steps (name, description, order_index) VALUES
('Prospecto', 'Cliente potencial identificado', 1),
('Contacto Inicial', 'Primer contacto realizado', 2),
('Presentación', 'Presentación de servicios', 3),
('Propuesta', 'Propuesta formal enviada', 4),
('Negociación', 'En proceso de negociación', 5),
('Cerrado', 'Venta completada', 6);