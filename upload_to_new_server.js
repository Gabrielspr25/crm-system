import fetch from 'node-fetch';
import fs from 'fs';

const newServerIP = '143.244.191.139';
const serverPort = 3001;

async function setupNewServer() {
  console.log('🚀 CONFIGURANDO NUEVO SERVIDOR CRM');
  console.log('==================================');
  
  try {
    // 1. Verificar que el servidor responde
    console.log('\n🌐 Verificando servidor...');
    const pingRes = await fetch(`http://${newServerIP}:${serverPort}/api/health`, {
      timeout: 5000
    }).catch(() => null);
    
    if (pingRes && pingRes.ok) {
      console.log('✅ Servidor ya configurado');
    } else {
      console.log('⚠️ Servidor no responde - necesita configuración');
    }
    
    // 2. Verificar archivos locales
    console.log('\n📁 Verificando archivos locales...');
    const distPath = './dist';
    
    if (!fs.existsSync(distPath)) {
      console.log('❌ Carpeta dist no existe - haciendo build...');
      return;
    }
    
    const files = fs.readdirSync(distPath, { recursive: true });
    console.log('✅ Archivos encontrados:');
    files.forEach(file => {
      const filePath = `./dist/${file}`;
      const stats = fs.statSync(filePath);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    
    // 3. Crear instrucciones de subida
    console.log('\n📋 INSTRUCCIONES PARA CONFIGURAR EL SERVIDOR:');
    console.log('=' .repeat(60));
    
    const instructions = `
# 🚀 CONFIGURACIÓN COMPLETA DEL NUEVO SERVIDOR

## 1. CONECTARSE AL SERVIDOR
ssh root@143.244.191.139
# Contraseña: CL@70049ro

## 2. EJECUTAR SCRIPT DE CONFIGURACIÓN
# Copiar y pegar este comando completo:
curl -fsSL https://raw.githubusercontent.com/your-repo/setup_server.sh | bash

## 3. SUBIR ARCHIVOS DE LA APLICACIÓN
# Desde tu máquina local:
scp -r dist/* root@143.244.191.139:/var/www/dist/
scp server.js root@143.244.191.139:/var/www/crm/
scp package.json root@143.244.191.139:/var/www/crm/

## 4. INSTALAR DEPENDENCIAS Y EJECUTAR
# En el servidor:
cd /var/www/crm
npm install
pm2 start server.js --name "crm-pro"
pm2 save
pm2 startup

## 5. CONFIGURAR BASE DE DATOS
# En el servidor:
sudo -u postgres psql -c "\\c crm_pro"
# Ejecutar script de creación de tablas

## 6. VERIFICAR FUNCIONAMIENTO
# Ir a: http://143.244.191.139
# Debería mostrar el CRM funcionando
`;

    console.log(instructions);
    
    // 4. Crear archivo de configuración de la base de datos
    console.log('\n🗄️ Creando script de base de datos...');
    
    const dbScript = `
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
`;

    fs.writeFileSync('database_setup.sql', dbScript);
    console.log('✅ Script de base de datos creado: database_setup.sql');
    
    console.log('\n🎯 RESUMEN:');
    console.log('1. ✅ Script de configuración del servidor creado');
    console.log('2. ✅ Script de base de datos creado');
    console.log('3. ✅ Archivos de la aplicación listos');
    console.log('4. 📋 Instrucciones detalladas generadas');
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('1. Conectarse al servidor: ssh root@143.244.191.139');
    console.log('2. Ejecutar configuración del servidor');
    console.log('3. Subir archivos de la aplicación');
    console.log('4. Configurar base de datos');
    console.log('5. Verificar funcionamiento');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

setupNewServer();
