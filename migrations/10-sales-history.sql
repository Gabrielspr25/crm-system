-- Migración 10: Crear tabla sales_history para guardar historial de ventas
-- Fecha: 2026-02-05
-- Autor: Sistema CRM

-- Crear tabla sales_history para rastrear ventas completadas desde seguimiento
CREATE TABLE IF NOT EXISTS sales_history (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prospect_id INTEGER REFERENCES follow_up_prospects(id) ON DELETE SET NULL,
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_value NUMERIC(10,2) DEFAULT 0,
  fijo_ren NUMERIC(10,2) DEFAULT 0,
  fijo_new NUMERIC(10,2) DEFAULT 0,
  movil_nueva NUMERIC(10,2) DEFAULT 0,
  movil_renovacion NUMERIC(10,2) DEFAULT 0,
  claro_tv NUMERIC(10,2) DEFAULT 0,
  cloud NUMERIC(10,2) DEFAULT 0,
  mpls NUMERIC(10,2) DEFAULT 0,
  sale_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_sales_history_client_id ON sales_history(client_id);
CREATE INDEX idx_sales_history_sale_date ON sales_history(sale_date);
CREATE INDEX idx_sales_history_salesperson_id ON sales_history(salesperson_id);
CREATE INDEX idx_sales_history_subscriber_id ON sales_history(subscriber_id);

-- Comentarios para documentación
COMMENT ON TABLE sales_history IS 'Historial de ventas completadas desde el sistema de seguimiento';
COMMENT ON COLUMN sales_history.prospect_id IS 'Referencia al prospecto de seguimiento que generó la venta';
COMMENT ON COLUMN sales_history.subscriber_id IS 'Referencia al suscriptor que generó la venta';
COMMENT ON COLUMN sales_history.monthly_value IS 'Valor mensual recurrente (MRC) del servicio';
COMMENT ON COLUMN sales_history.total_amount IS 'Valor total de la venta (puede incluir instalación, equipos, etc.)';
COMMENT ON COLUMN sales_history.sale_date IS 'Fecha en que se completó la venta';
