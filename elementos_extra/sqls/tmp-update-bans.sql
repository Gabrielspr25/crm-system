-- Actualizar BANs sin status a 'active' por defecto
UPDATE bans SET status = 'active' WHERE status IS NULL;

