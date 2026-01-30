-- Rollback: Eliminar BANs y suscriptores creados en migración 11
BEGIN;

DELETE FROM subscribers 
WHERE ban_id IN (
  SELECT b.id FROM bans b
  WHERE ban_number LIKE '900%'
);

DELETE FROM bans 
WHERE ban_number LIKE '900%';

COMMIT;
