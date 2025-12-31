-- =====================================================
-- ESQUEMA DE BASE DE DATOS - MÓDULO TARIFAS
-- CRM Pro - Generado: 2025-12-27
-- =====================================================

-- =====================================================
-- TABLA: plan_categories
-- Categorías de planes (1PLAY, 2PLAY, 3PLAY, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS plan_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos iniciales de categorías
INSERT INTO plan_categories (name, description, color, icon, sort_order) VALUES
('MOVIL', 'Planes de telefonía móvil', '#EF4444', 'smartphone', 1),
('1PLAY', 'Planes de un solo servicio (Internet o Telefonía)', '#3B82F6', 'wifi', 2),
('2PLAY', 'Planes con dos servicios combinados', '#8B5CF6', 'package', 3),
('3PLAY', 'Planes con tres servicios (Internet + TV + Telefonía)', '#10B981', 'layers', 4),
('TV', 'Planes de televisión', '#F59E0B', 'tv', 5),
('ADDON', 'Servicios adicionales', '#6B7280', 'plus-circle', 6)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- TABLA: plans
-- Planes/Tarifas principales
-- =====================================================
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,                    -- Job Code (A155, 7203, etc.)
    alpha_code VARCHAR(30),                       -- Alfa Code (G-BMLADPQT, BPRU5M, etc.)
    description TEXT NOT NULL,                    -- Descripción del servicio
    price DECIMAL(10,2) DEFAULT 0,                -- Renta mensual
    category_id INTEGER REFERENCES plan_categories(id),
    technology VARCHAR(50),                       -- GPON, COBRE, VRAD, etc.
    speed_download INTEGER,                       -- Velocidad de bajada en Mbps
    speed_upload INTEGER,                         -- Velocidad de subida en Mbps
    installation_0m DECIMAL(10,2) DEFAULT 0,      -- Costo instalación 0 meses
    installation_12m DECIMAL(10,2) DEFAULT 0,     -- Costo instalación 12 meses
    installation_24m DECIMAL(10,2) DEFAULT 0,     -- Costo instalación 24 meses
    penalty DECIMAL(10,2) DEFAULT 0,              -- Penalidad por cancelación
    is_active BOOLEAN DEFAULT true,
    is_promotional BOOLEAN DEFAULT false,
    valid_from DATE,
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);
CREATE INDEX IF NOT EXISTS idx_plans_alpha_code ON plans(alpha_code);
CREATE INDEX IF NOT EXISTS idx_plans_category ON plans(category_id);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);

-- =====================================================
-- TABLA: plan_history
-- Historial de cambios en planes (auditoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS plan_history (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL,                  -- CREATE, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_history_record ON plan_history(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_plan_history_date ON plan_history(changed_at);

-- =====================================================
-- TABLA: offers
-- Ofertas especiales y promociones
-- =====================================================
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20),                    -- PERCENTAGE, FIXED, FREE_MONTHS
    discount_value DECIMAL(10,2),
    applicable_plans INTEGER[],                   -- Array de IDs de planes aplicables
    conditions TEXT,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLA: benefits
-- Beneficios adicionales de los planes
-- =====================================================
CREATE TABLE IF NOT EXISTS benefits (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    plan_ids INTEGER[],                           -- Planes que incluyen este beneficio
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLA: sales_guides
-- Guías de venta para vendedores
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_guides (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    category VARCHAR(50),
    tags VARCHAR(200)[],
    attachment_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CONSULTAS ÚTILES
-- =====================================================

-- Ver todos los planes activos con su categoría
-- SELECT p.*, pc.name as category_name 
-- FROM plans p 
-- LEFT JOIN plan_categories pc ON p.category_id = pc.id 
-- WHERE p.is_active = true 
-- ORDER BY pc.sort_order, p.price;

-- Ver planes por tecnología
-- SELECT * FROM plans WHERE technology = 'GPON' AND is_active = true;

-- Buscar plan por código
-- SELECT * FROM plans WHERE code = 'A155' OR alpha_code = 'G-BMLADPQT';

-- Historial de cambios de un plan
-- SELECT * FROM plan_history WHERE table_name = 'plans' AND record_id = 1 ORDER BY changed_at DESC;

-- Contar planes por categoría
-- SELECT pc.name, COUNT(p.id) as total 
-- FROM plan_categories pc 
-- LEFT JOIN plans p ON pc.id = p.category_id AND p.is_active = true 
-- GROUP BY pc.id, pc.name 
-- ORDER BY pc.sort_order;
