-- Eliminar venta completada de MR BLACK INC
DELETE FROM follow_up_prospects 
WHERE id = 62 
AND client_id IN (SELECT id FROM clients WHERE name = 'MR BLACK INC')
AND completed_date IS NOT NULL;

-- Verificar que se eliminó
SELECT COUNT(*) as registros_eliminados FROM follow_up_prospects 
WHERE client_id IN (SELECT id FROM clients WHERE name = 'MR BLACK INC')
AND completed_date IS NOT NULL;
