-- Script para creación de tabla en PostgreSQL
-- Compatible con la App de Referidos v1.0

CREATE TABLE IF NOT EXISTS referidos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    tipo VARCHAR(50) DEFAULT 'Masivo', -- 'Masivo' o 'Negocio'
    suscriptor VARCHAR(50),
    modelo VARCHAR(100),
    color VARCHAR(50),
    vendedor VARCHAR(100),
    estado VARCHAR(50) DEFAULT 'Pendiente',
    reservado BOOLEAN DEFAULT FALSE,
    fecha DATE DEFAULT CURRENT_DATE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar la búsqueda
CREATE INDEX idx_referidos_nombre ON referidos(nombre);
CREATE INDEX idx_referidos_email ON referidos(email);
CREATE INDEX idx_referidos_modelo ON referidos(modelo);
CREATE INDEX idx_referidos_estado ON referidos(estado);
