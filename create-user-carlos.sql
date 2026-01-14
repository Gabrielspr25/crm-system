-- Crear usuario carlos con password VentasPro2026!
-- Hash bcrypt de 'VentasPro2026!' generado con 10 rounds
INSERT INTO users_auth (username, password, salesperson_id, created_at) 
VALUES (
  'carlos', 
  '$2b$10$rX8kZqGN7YvL.nB/HXhqYOQKj5F9wZ2nMQoT8xC3vP1hS6kL4mN9G',
  '91bdb279-b081-4835-bdb7-7d0a239d2713',
  NOW()
) 
RETURNING username, salesperson_id;
