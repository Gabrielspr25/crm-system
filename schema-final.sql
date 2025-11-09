-- ===============================================
-- 🗄️ SCHEMA COMPLETO CRM PRO - FINAL
-- ===============================================
-- Cliente → BAN → Suscriptor + Sistema Completo

-- Eliminar tablas existentes (orden inverso por dependencias)
DROP TABLE IF EXISTS subscribers CASCADE;
DROP TABLE IF EXISTS bans CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS metas CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS incomes CASCADE;
DROP TABLE IF EXISTS pipeline_notes CASCADE;
DROP TABLE IF EXISTS pipeline_statuses CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users_auth CASCADE;
DROP TABLE IF EXISTS salespeople CASCADE;

-- ===============================================
-- TABLA: VENDEDORES (SALESPEOPLE)
-- ===============================================
CREATE TABLE salespeople (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    avatar TEXT,
    role VARCHAR(50) DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
    monthly_sales_goal DECIMAL(10,2) DEFAULT 0,
    theme JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: AUTENTICACIÓN USUARIOS
-- ===============================================
CREATE TABLE users_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    salesperson_id UUID NOT NULL REFERENCES salespeople(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- ===============================================
-- TABLA: CATEGORÍAS
-- ===============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: PRODUCTOS
-- ===============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    price DECIMAL(10,2) DEFAULT 0,
    monthly_goal INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: ESTADOS DE PIPELINE
-- ===============================================
CREATE TABLE pipeline_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280',
    order_position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: CLIENTES (Jerarquía principal)
-- ===============================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    zip_code VARCHAR(20),
    salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL,
    pipeline_status_id UUID REFERENCES pipeline_statuses(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: BANS (Cuentas de facturación - 9 dígitos)
-- ===============================================
CREATE TABLE bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    number VARCHAR(9) NOT NULL UNIQUE CHECK (number ~ '^[0-9]{9}$'),
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo', 'suspendido')),
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: SUSCRIPTORES (Líneas de servicio - 10 dígitos)
-- ===============================================
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ban_id UUID NOT NULL REFERENCES bans(id) ON DELETE CASCADE,
    phone_number VARCHAR(10) NOT NULL CHECK (phone_number ~ '^[0-9]{10}$'),
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'cancelado', 'suspendido')),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    contract_end_date DATE,
    equipment VARCHAR(255),
    city VARCHAR(100),
    months_sold INTEGER DEFAULT 0,
    payments_made INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: NOTAS DE PIPELINE
-- ===============================================
CREATE TABLE pipeline_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: INGRESOS
-- ===============================================
CREATE TABLE incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    income_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: GASTOS
-- ===============================================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL,
    category VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- TABLA: METAS
-- ===============================================
CREATE TABLE metas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salesperson_id UUID REFERENCES salespeople(id) ON DELETE CASCADE,
    meta_valor DECIMAL(10,2) NOT NULL,
    periodo VARCHAR(50) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    tipo_meta VARCHAR(100) NOT NULL,
    categoria VARCHAR(255),
    descripcion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===============================================

-- Clientes
CREATE INDEX idx_clients_salesperson ON clients(salesperson_id);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_company ON clients(company);

-- BANs
CREATE INDEX idx_bans_client ON bans(client_id);
CREATE INDEX idx_bans_number ON bans(number);
CREATE INDEX idx_bans_status ON bans(status);

-- Suscriptores
CREATE INDEX idx_subscribers_ban ON subscribers(ban_id);
CREATE INDEX idx_subscribers_phone ON subscribers(phone_number);
CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_subscribers_contract_date ON subscribers(contract_end_date);

-- Productos y categorías
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name);

-- Timestamps para consultas por fecha
CREATE INDEX idx_subscribers_created ON subscribers(created_at);
CREATE INDEX idx_clients_created ON clients(created_at);
CREATE INDEX idx_incomes_date ON incomes(income_date);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- ===============================================
-- TRIGGERS PARA UPDATED_AT
-- ===============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salespeople_updated_at BEFORE UPDATE ON salespeople
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metas_updated_at BEFORE UPDATE ON metas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- DATOS INICIALES (SEEDS)
-- ===============================================

-- Vendedores por defecto
INSERT INTO salespeople (name, email, role, monthly_sales_goal) VALUES
('Admin Principal', 'admin@crm.com', 'admin', 50000.00),
('Gabriel Rodríguez', 'gabriel@crm.com', 'admin', 40000.00),
('María González', 'maria@crm.com', 'vendedor', 30000.00),
('Juan Pérez', 'juan@crm.com', 'vendedor', 25000.00);

-- Usuarios de autenticación (contraseña: 1234)
INSERT INTO users_auth (username, password, salesperson_id) VALUES
('admin', '$2b$10$K7H.Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K', (SELECT id FROM salespeople WHERE email = 'admin@crm.com')),
('gabriel', '$2b$10$K7H.Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K', (SELECT id FROM salespeople WHERE email = 'gabriel@crm.com')),
('maria', '$2b$10$K7H.Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K', (SELECT id FROM salespeople WHERE email = 'maria@crm.com')),
('juan', '$2b$10$K7H.Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K5fR8Kv9Xf5OtR7Xn5JX5K', (SELECT id FROM salespeople WHERE email = 'juan@crm.com'));

-- Categorías
INSERT INTO categories (name, description) VALUES
('Móvil', 'Planes y servicios móviles'),
('Internet', 'Servicios de internet residencial'),
('Empresarial', 'Soluciones para empresas'),
('TV', 'Servicios de televisión');

-- Productos
INSERT INTO products (name, category_id, price, monthly_goal) VALUES
('Plan Móvil Básico', (SELECT id FROM categories WHERE name = 'Móvil'), 29.99, 100),
('Plan Móvil Premium', (SELECT id FROM categories WHERE name = 'Móvil'), 59.99, 50),
('Internet 50MB', (SELECT id FROM categories WHERE name = 'Internet'), 39.99, 75),
('Internet 100MB', (SELECT id FROM categories WHERE name = 'Internet'), 59.99, 50),
('Paquete Empresarial', (SELECT id FROM categories WHERE name = 'Empresarial'), 199.99, 10),
('TV Básica', (SELECT id FROM categories WHERE name = 'TV'), 24.99, 60);

-- Estados de pipeline
INSERT INTO pipeline_statuses (name, color, order_position) VALUES
('Nuevo', '#3B82F6', 1),
('Contactado', '#F59E0B', 2),
('Interesado', '#10B981', 3),
('Propuesta', '#8B5CF6', 4),
('Ganado', '#059669', 5),
('Perdido', '#DC2626', 6);

-- ===============================================
-- DATOS DE PRUEBA PARA LÓGICA CLIENTE → BAN → SUSCRIPTOR
-- ===============================================

-- Cliente de prueba
INSERT INTO clients (name, company, email, phone, mobile, address, city, zip_code, salesperson_id, pipeline_status_id, notes) VALUES
('Dr. Olga Rodríguez', 'Clínica Rodríguez', 'olga@clinica.com', '7871234567', '7879876543', 'Calle Salud 123', 'Ponce', '00731', 
 (SELECT id FROM salespeople WHERE email = 'maria@crm.com'), 
 (SELECT id FROM pipeline_statuses WHERE name = 'Ganado'),
 'Cliente VIP - Clínica médica con múltiples líneas');

-- BANs para el cliente
INSERT INTO bans (client_id, number, status) VALUES
((SELECT id FROM clients WHERE email = 'olga@clinica.com'), '123456789', 'activo'),
((SELECT id FROM clients WHERE email = 'olga@clinica.com'), '987654321', 'activo');

-- Suscriptores con fechas de vencimiento para testing
INSERT INTO subscribers (ban_id, phone_number, status, product_id, category_id, contract_end_date, equipment, city, months_sold, payments_made, notes) VALUES

-- BAN 123456789 - Suscriptores con diferentes estados de vencimiento
((SELECT id FROM bans WHERE number = '123456789'), '7871234567', 'activo', 
 (SELECT id FROM products WHERE name = 'Plan Móvil Premium'), 
 (SELECT id FROM categories WHERE name = 'Móvil'), 
 '2024-10-15',  -- VENCIDO (para testing de alertas)
 'iPhone 14', 'San Juan', 12, 8, 'Línea principal - VENCIDA'),

((SELECT id FROM bans WHERE number = '123456789'), '7879876543', 'activo', 
 (SELECT id FROM products WHERE name = 'Plan Móvil Básico'), 
 (SELECT id FROM categories WHERE name = 'Móvil'), 
 '2025-01-25',  -- URGENTE (vence en pocos días)
 'Samsung S23', 'Bayamón', 6, 4, 'Línea secundaria - URGENTE'),

((SELECT id FROM bans WHERE number = '123456789'), '7875551234', 'activo', 
 (SELECT id FROM products WHERE name = 'Internet 100MB'), 
 (SELECT id FROM categories WHERE name = 'Internet'), 
 '2025-07-15',  -- NORMAL (vence en el futuro)
 'Modem WiFi', 'Caguas', 12, 2, 'Internet clínica - NORMAL'),

-- BAN 987654321 - Más suscriptores
((SELECT id FROM bans WHERE number = '987654321'), '7872223333', 'activo', 
 (SELECT id FROM products WHERE name = 'TV Básica'), 
 (SELECT id FROM categories WHERE name = 'TV'), 
 '2025-03-10',  -- ADVERTENCIA (30 días)
 'Decodificador HD', 'Ponce', 24, 18, 'TV sala de espera'),

((SELECT id FROM bans WHERE number = '987654321'), '7874445555', 'cancelado', 
 (SELECT id FROM products WHERE name = 'Plan Móvil Básico'), 
 (SELECT id FROM categories WHERE name = 'Móvil'), 
 '2024-12-01', 
 'iPhone 12', 'Ponce', 12, 12, 'Línea cancelada por cliente');

-- ===============================================
-- VISTA PARA ALERTAS DE VENCIMIENTO
-- ===============================================
CREATE OR REPLACE VIEW subscriber_alerts AS
SELECT 
    s.id as subscriber_id,
    s.phone_number,
    s.contract_end_date,
    s.status,
    s.equipment,
    s.city,
    b.id as ban_id,
    b.number as ban_number,
    c.id as client_id,
    c.name as client_name,
    c.company as client_company,
    sp.name as salesperson_name,
    p.name as product_name,
    cat.name as category_name,
    -- Cálculo de días hasta vencimiento
    (s.contract_end_date - CURRENT_DATE) as days_to_expiry,
    -- Nivel de urgencia
    CASE 
        WHEN s.contract_end_date < CURRENT_DATE THEN 'VENCIDO'
        WHEN s.contract_end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'URGENTE'
        WHEN s.contract_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'ADVERTENCIA'
        ELSE 'NORMAL'
    END as urgency_level
FROM subscribers s
JOIN bans b ON s.ban_id = b.id
JOIN clients c ON b.client_id = c.id
LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
LEFT JOIN products p ON s.product_id = p.id
LEFT JOIN categories cat ON s.category_id = cat.id
WHERE s.status = 'activo'
ORDER BY s.contract_end_date ASC;

-- ===============================================
-- FUNCIÓN PARA OBTENER RESUMEN DE CLIENTE
-- ===============================================
CREATE OR REPLACE FUNCTION get_client_summary(client_uuid UUID)
RETURNS TABLE(
    client_name VARCHAR(255),
    total_bans BIGINT,
    total_subscribers BIGINT,
    active_subscribers BIGINT,
    expired_subscribers BIGINT,
    urgent_subscribers BIGINT,
    warning_subscribers BIGINT,
    earliest_expiry DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name,
        COUNT(DISTINCT b.id)::BIGINT as total_bans,
        COUNT(s.id)::BIGINT as total_subscribers,
        COUNT(CASE WHEN s.status = 'activo' THEN 1 END)::BIGINT as active_subscribers,
        COUNT(CASE WHEN s.contract_end_date < CURRENT_DATE AND s.status = 'activo' THEN 1 END)::BIGINT as expired_subscribers,
        COUNT(CASE WHEN s.contract_end_date <= CURRENT_DATE + INTERVAL '7 days' AND s.contract_end_date >= CURRENT_DATE AND s.status = 'activo' THEN 1 END)::BIGINT as urgent_subscribers,
        COUNT(CASE WHEN s.contract_end_date <= CURRENT_DATE + INTERVAL '30 days' AND s.contract_end_date > CURRENT_DATE + INTERVAL '7 days' AND s.status = 'activo' THEN 1 END)::BIGINT as warning_subscribers,
        MIN(s.contract_end_date) as earliest_expiry
    FROM clients c
    LEFT JOIN bans b ON c.id = b.client_id
    LEFT JOIN subscribers s ON b.id = s.ban_id
    WHERE c.id = client_uuid
    GROUP BY c.name;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===============================================
COMMENT ON TABLE clients IS 'Entidad principal - Empresas o personas que contratan servicios';
COMMENT ON TABLE bans IS 'Cuentas de facturación de 9 dígitos - Una por cliente, puede tener múltiples suscriptores';
COMMENT ON TABLE subscribers IS 'Líneas de servicio de 10 dígitos - Cada una asociada a un BAN';

COMMENT ON COLUMN bans.number IS 'Número único de 9 dígitos para facturación';
COMMENT ON COLUMN subscribers.phone_number IS 'Número de teléfono/línea de 10 dígitos';
COMMENT ON COLUMN subscribers.contract_end_date IS 'Fecha de vencimiento del contrato - Crítica para alertas';
COMMENT ON COLUMN subscribers.months_sold IS 'Meses vendidos originalmente';
COMMENT ON COLUMN subscribers.payments_made IS 'Pagos realizados hasta la fecha';

-- ===============================================
-- VERIFICACIÓN FINAL
-- ===============================================
SELECT 'Schema CRM Pro creado exitosamente!' as mensaje;