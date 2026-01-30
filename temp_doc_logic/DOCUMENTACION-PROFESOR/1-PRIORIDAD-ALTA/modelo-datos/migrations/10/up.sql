-- Migración: Agregar columna last_updated a tabla bans
ALTER TABLE bans ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();
