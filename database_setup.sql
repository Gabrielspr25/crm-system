
-- Script de creación de base de datos CRM
-- Ejecutar en PostgreSQL

-- Crear tablas principales
CREATE TABLE IF NOT EXISTS users_auth (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'vendedor',
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    salesperson_id INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bans (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clientes(id),
    phone_number VARCHAR(20) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'active',
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    ban_id INTEGER REFERENCES bans(id),
    phone_number VARCHAR(20) NOT NULL,
    months_sold INTEGER DEFAULT 0,
    payments_made INTEGER DEFAULT 0,
    salesperson_id INTEGER,
    product_id INTEGER,
    category_id INTEGER,
    contract_end_date DATE,
    equipment TEXT,
    city VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category_id INTEGER,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salespeople (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    rol VARCHAR(20) DEFAULT 'vendedor',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metas (
    id SERIAL PRIMARY KEY,
    vendedor_id INTEGER REFERENCES salespeople(id),
    meta_valor DECIMAL(12,2) NOT NULL,
    periodo VARCHAR(20) DEFAULT 'mensual',
    fecha_inicio DATE,
    fecha_fin DATE,
    activa BOOLEAN DEFAULT true,
    year INTEGER,
    month INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incomes (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    salesperson_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar datos de ejemplo
INSERT INTO users_auth (username, password_hash, rol, email) VALUES
('admin', '$2b$10$K7E8z.9QzQ3zRXQKJvWK3uGnV5yZ3X7oVKp', 'admin', 'admin@crm.local'),
('gabriel', '$2b$10$QfkZS9iTzFONFNJQ/sc55edP4A1HQpdQo2tlK', 'admin', 'gabriel@crm.local');

INSERT INTO salespeople (name, email, rol) VALUES
('Gabriel Rodríguez', 'gabriel@crm.local', 'admin'),
('María González', 'maria@crm.local', 'vendedor'),
('Juan Pérez', 'juan@crm.local', 'vendedor');

-- Insertar categorías
INSERT INTO categories (name) VALUES
('Internet Fijo'),
('Móvil'),
('Claro TV'),
('Cloud'),
('Hosting y Dominios'),
('Software y Licencias'),
('Hardware y Equipos'),
('Marketing Digital'),
('Servicios de Consultoría'),
('Capacitación y Cursos');

-- Insertar productos
INSERT INTO products (name, price, category_id, description) VALUES
('Internet 100 Mbps', 49.99, 1, 'Internet de alta velocidad'),
('Plan Móvil 5GB', 29.99, 2, 'Plan de datos móviles'),
('Claro TV Básico', 39.99, 3, 'Paquete de TV básico'),
('Cloud Storage 100GB', 9.99, 4, 'Almacenamiento en la nube'),
('Hosting Básico', 19.99, 5, 'Hosting web básico'),
('Office 365', 89.99, 6, 'Suite de productividad'),
('Laptop Empresarial', 899.99, 7, 'Laptop para empresas'),
('Campaña Google Ads', 500.00, 8, 'Publicidad en Google'),
('Consultoría IT', 150.00, 9, 'Servicios de consultoría'),
('Curso de Programación', 299.99, 10, 'Capacitación en programación');

COMMIT;
