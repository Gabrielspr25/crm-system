-- Agregar columna client_id a la tabla bans
ALTER TABLE bans ADD COLUMN IF NOT EXISTS client_id INTEGER;

-- Renombrar columna numero a number (si existe)
ALTER TABLE bans RENAME COLUMN numero TO number;

-- Agregar foreign key constraint (opcional)
-- ALTER TABLE bans ADD CONSTRAINT fk_bans_client_id FOREIGN KEY (client_id) REFERENCES clientes(id);