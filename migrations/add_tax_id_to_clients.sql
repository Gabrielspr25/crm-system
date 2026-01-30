-- Migración: Agregar campo tax_id a la tabla clients
-- Fecha: 2026-01-19
-- Descripción: Agrega columna para RNC o Cédula de identificación fiscal

-- Agregar columna tax_id
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id VARCHAR(20);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clients_tax_id ON clients(tax_id);

-- Comentario
COMMENT ON COLUMN clients.tax_id IS 'RNC o Cédula de identificación fiscal del cliente';
