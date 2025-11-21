// Script para verificar si las tablas existen y tienen datos
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

async function verificarTablas() {
  let client;
  let pool;
  
  try {
    pool = new pg.Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'crm_pro',
      user: process.env.DB_USER || 'crm_user',
      password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
    });
    client = await pool.connect();
    console.log('✅ Conectado a la BD');
  } catch (error) {
    console.log('⚠️ Falló con crm_user, intentando con postgres...');
    pool = new pg.Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'crm_pro',
      user: 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
    client = await pool.connect();
    console.log('✅ Conectado con postgres');
  }
  
  try {
    console.log('\n===================================================');
    console.log('  VERIFICANDO TABLAS Y DATOS');
    console.log('===================================================');
    console.log('');

    // Listar TODAS las tablas en public schema
    const todasTablas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 TODAS las tablas en la BD:');
    if (todasTablas.rows.length === 0) {
      console.log('  ⚠️ No se encontraron tablas');
    } else {
      todasTablas.rows.forEach(row => {
        console.log('  -', row.table_name);
      });
    }
    console.log('');

    // Verificar si existen las tablas que necesitamos
    const tablasNecesarias = ['clients', 'bans', 'subscribers'];
    console.log('🔍 Verificando tablas necesarias:');
    for (const tabla of tablasNecesarias) {
      const existe = todasTablas.rows.some(r => r.table_name === tabla);
      if (existe) {
        try {
          const count = await client.query(`SELECT COUNT(*) as total FROM ${tabla}`);
          const total = parseInt(count.rows[0].total);
          console.log(`  ✅ ${tabla}: EXISTE - ${total} registros`);
        } catch (error) {
          console.log(`  ⚠️ ${tabla}: EXISTE pero no se puede leer - ${error.message}`);
        }
      } else {
        console.log(`  ❌ ${tabla}: NO EXISTE`);
      }
    }
    console.log('');

    // Intentar contar directamente
    console.log('📊 Conteo directo de registros:');
    try {
      const clients = await client.query('SELECT COUNT(*) as total FROM clients');
      console.log(`  - Clientes: ${clients.rows[0].total}`);
    } catch (error) {
      console.log(`  - Clientes: ERROR - ${error.message}`);
    }
    
    try {
      const bans = await client.query('SELECT COUNT(*) as total FROM bans');
      console.log(`  - BANs: ${bans.rows[0].total}`);
    } catch (error) {
      console.log(`  - BANs: ERROR - ${error.message}`);
    }
    
    try {
      const subs = await client.query('SELECT COUNT(*) as total FROM subscribers');
      console.log(`  - Suscriptores: ${subs.rows[0].total}`);
    } catch (error) {
      console.log(`  - Suscriptores: ERROR - ${error.message}`);
    }

    console.log('');
    console.log('===================================================');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarTablas().catch(console.error);

