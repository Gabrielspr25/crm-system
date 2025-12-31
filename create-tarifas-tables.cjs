// Script para crear tablas del módulo Tarifas
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creando tablas del módulo Tarifas...\n');

    // 1. CATEGORÍAS DE PLANES
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        code VARCHAR(20) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(20),
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla plan_categories creada');

    // Insertar categorías base
    await client.query(`
      INSERT INTO plan_categories (name, code, description, icon, color, display_order) VALUES
        ('Móvil', 'MOVIL', 'Planes de telefonía móvil', 'Smartphone', 'red', 1),
        ('Fijo', 'FIJO', 'Servicios de voz fija', 'Phone', 'blue', 2),
        ('Internet', 'INTERNET', 'Servicios de internet', 'Wifi', 'green', 3),
        ('TV', 'TV', 'Claro TV', 'MonitorPlay', 'purple', 4),
        ('2 Play', '2PLAY', 'Combos Internet + Voz', 'Package', 'cyan', 5),
        ('3 Play', '3PLAY', 'Triple Play (Internet + Voz + TV)', 'Layers', 'orange', 6)
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log('✅ Categorías base insertadas');

    // 2. PLANES BASE
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES plan_categories(id),
        name VARCHAR(200) NOT NULL,
        code VARCHAR(50),
        alpha_code VARCHAR(50),
        description TEXT,
        price DECIMAL(10,2),
        price_autopay DECIMAL(10,2),
        technology VARCHAR(50),
        data_included VARCHAR(100),
        voice_included VARCHAR(100),
        sms_included VARCHAR(100),
        hotspot VARCHAR(50),
        roaming_info TEXT,
        installation_0m DECIMAL(10,2),
        installation_12m DECIMAL(10,2),
        installation_24m DECIMAL(10,2),
        penalty DECIMAL(10,2),
        min_lines INT DEFAULT 1,
        max_lines INT,
        notes TEXT,
        is_convergent_only BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by INT,
        updated_by INT
      );
    `);
    console.log('✅ Tabla plans creada');

    // 3. OFERTAS TEMPORALES
    await client.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category_id INT REFERENCES plan_categories(id),
        offer_type VARCHAR(50),
        discount_type VARCHAR(20),
        discount_value DECIMAL(10,2),
        applicable_plans TEXT[],
        conditions TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        is_convergent_only BOOLEAN DEFAULT false,
        is_new_customer_only BOOLEAN DEFAULT false,
        is_portability_only BOOLEAN DEFAULT false,
        bulletin_reference VARCHAR(100),
        attachment_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by INT,
        updated_by INT
      );
    `);
    console.log('✅ Tabla offers creada');

    // 4. BENEFICIOS
    await client.query(`
      CREATE TABLE IF NOT EXISTS benefits (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        benefit_type VARCHAR(50),
        value VARCHAR(100),
        value_convergent VARCHAR(100),
        category VARCHAR(50),
        requirements TEXT,
        legal_terms TEXT,
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by INT,
        updated_by INT
      );
    `);
    console.log('✅ Tabla benefits creada');

    // 5. GUÍAS DE VENTA (ENTRENAMIENTO)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_guides (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        content TEXT,
        steps JSONB,
        attachments JSONB,
        tags TEXT[],
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by INT,
        updated_by INT
      );
    `);
    console.log('✅ Tabla sales_guides creada');

    // 6. HISTORIAL DE CAMBIOS
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_history (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL,
        record_id INT NOT NULL,
        action VARCHAR(20) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        changed_by INT,
        changed_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      );
    `);
    console.log('✅ Tabla plan_history creada');

    // Crear índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plans_category ON plans(category_id);
      CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);
      CREATE INDEX IF NOT EXISTS idx_offers_dates ON offers(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active);
      CREATE INDEX IF NOT EXISTS idx_benefits_active ON benefits(is_active);
      CREATE INDEX IF NOT EXISTS idx_guides_category ON sales_guides(category);
    `);
    console.log('✅ Índices creados');

    console.log('\n🎉 ¡Todas las tablas del módulo Tarifas creadas exitosamente!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
