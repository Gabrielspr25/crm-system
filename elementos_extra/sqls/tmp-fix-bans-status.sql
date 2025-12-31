-- Actualizar valores de status a inglés para consistencia con el backend
UPDATE bans SET status = 'active' WHERE status = 'activo';
UPDATE bans SET status = 'cancelled' WHERE status = 'cancelado';

