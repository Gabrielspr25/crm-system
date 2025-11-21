// Script para verificar qué usuario está usando realmente el backend
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

// Intentar con las mismas credenciales del servidor
const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
  max: 10,
  idleTimeoutMillis: 30_000
});

async function verificar() {
  try {
    console.log('\n===================================================');
    console.log('  VERIFICANDO USUARIO DE BD');
    console.log('===================================================');
    console.log('');
    console.log('Credenciales del .env:');
    console.log(`  Host: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log(`  Port: ${process.env.DB_PORT || 5432}`);
    console.log(`  Database: ${process.env.DB_NAME || 'crm_pro'}`);
    console.log(`  User: ${process.env.DB_USER || 'crm_user'}`);
    console.log(`  Password: ${process.env.DB_PASSWORD ? '***' : 'undefined'}`);
    console.log('');

    const client = await pool.connect();
    
    // Verificar usuario actual
    const userInfo = await client.query('SELECT current_user, current_database(), session_user');
    console.log('Usuario REAL conectado:');
    console.log(`  current_user: ${userInfo.rows[0].current_user}`);
    console.log(`  session_user: ${userInfo.rows[0].session_user}`);
    console.log(`  database: ${userInfo.rows[0].current_database}`);
    console.log('');

    // Intentar contar registros
    try {
      const clients = await client.query('SELECT COUNT(*) as total FROM clients');
      console.log(`✅ Puede leer clients: ${clients.rows[0].total} registros`);
    } catch (e) {
      console.log(`❌ No puede leer clients: ${e.message}`);
    }
    
    try {
      const bans = await client.query('SELECT COUNT(*) as total FROM bans');
      console.log(`✅ Puede leer bans: ${bans.rows[0].total} registros`);
    } catch (e) {
      console.log(`❌ No puede leer bans: ${e.message}`);
    }
    
    try {
      const subs = await client.query('SELECT COUNT(*) as total FROM subscribers');
      console.log(`✅ Puede leer subscribers: ${subs.rows[0].total} registros`);
    } catch (e) {
      console.log(`❌ No puede leer subscribers: ${e.message}`);
    }

    client.release();
    await pool.end();
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

verificar().catch(console.error);

