-- Mapeo vendors (INTEGER legacy) → salespeople (UUID nuevo)
-- GABRIEL (12) → Gabriel Rodríguez
-- RANDY (13) → María González  
-- DAYANA (14) → Admin Principal
-- HERNAN (15) → Gabriel Rodríguez

INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id) 
VALUES 
  (12, '181a77b4-583c-4455-8e83-3147f540db68'), -- GABRIEL
  (13, 'e56b034f-7370-4cb0-aebe-44cd81f14051'), -- RANDY
  (14, '549e0bd3-f2de-406f-a6de-751860c5fc08'), -- DAYANA
  (15, '181a77b4-583c-4455-8e83-3147f540db68')  -- HERNAN
ON CONFLICT DO NOTHING;
