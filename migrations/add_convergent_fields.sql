-- Migration: Add convergent pricing fields to plans table
-- Date: 2025-12-28

-- Add convergent price and benefits to plans
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS price_convergent DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS convergent_benefits TEXT[];

-- Add comment
COMMENT ON COLUMN plans.price_convergent IS 'Precio especial para clientes convergentes (Claro Full)';
COMMENT ON COLUMN plans.convergent_benefits IS 'Array de beneficios adicionales para convergentes';

-- Create knowledge_documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  file_path TEXT,
  file_type VARCHAR(20),
  file_size INTEGER,
  extracted_text TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON knowledge_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_documents USING GIN(tags);

-- Add full text search index for extracted_text
CREATE INDEX IF NOT EXISTS idx_knowledge_text_search ON knowledge_documents USING GIN(to_tsvector('spanish', extracted_text));

COMMENT ON TABLE knowledge_documents IS 'Documentos de procesos y guías para la base de conocimientos de la IA';
