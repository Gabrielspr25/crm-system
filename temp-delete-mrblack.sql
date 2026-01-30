-- Eliminar registro de seguimiento de MR BLACK
DELETE FROM follow_up_prospects 
WHERE client_id = (
  SELECT id FROM clients WHERE business_name ILIKE '%BLACK%'
);
