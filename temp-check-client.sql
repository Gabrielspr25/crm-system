-- Verificar si el cliente existe
SELECT id, name FROM clients WHERE id = 'cd883dc2-2348-4c73-9766-0a58657e4fc9';

-- Ver todos los prospectos con ese client_id
SELECT id, company_name, client_id FROM follow_up_prospects WHERE client_id = 'cd883dc2-2348-4c73-9766-0a58657e4fc9';
