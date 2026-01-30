-- Rollback: Eliminar columna last_updated de tabla bans
ALTER TABLE bans DROP COLUMN IF EXISTS last_updated;
