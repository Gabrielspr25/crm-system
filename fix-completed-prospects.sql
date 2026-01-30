-- Asignar salesperson_id a clientes de prospects completados
-- Mapeo: vendor_id 12 (GABRIEL en vendors) -> Gabriel Sanchez en salespeople

UPDATE clients 
SET salesperson_id = '181a77b4-583c-4455-8e83-3147f540db68'
WHERE id IN (
  SELECT client_id 
  FROM follow_up_prospects 
  WHERE completed_date IS NOT NULL 
    AND vendor_id = 12
    AND client_id IS NOT NULL
);

-- Verificar cambios
SELECT c.id, c.name, c.salesperson_id
FROM clients c
JOIN follow_up_prospects fup ON fup.client_id = c.id
WHERE fup.completed_date IS NOT NULL;
