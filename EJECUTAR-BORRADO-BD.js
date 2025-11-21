// Script para ejecutar el borrado usando las mismas funciones del servidor
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

// Usar EXACTAMENTE las mismas credenciales que server-FINAL.js
const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
  max: 10,
  idleTimeoutMillis: 30_000
});

// Usar la misma función query que el servidor
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function borrarDatos() {
  try {
    console.log('\n===================================================');
    console.log('  ⚠️  BORRANDO DATOS DE LA BD  ⚠️');
    console.log('===================================================');
    console.log('');
    console.log(`Conectado a: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'crm_pro'}`);
    console.log('');

    // Contar antes
    console.log('[1/4] Contando registros ANTES de borrar...');
    const antes = await Promise.all([
      query('SELECT COUNT(*) as total FROM subscribers'),
      query('SELECT COUNT(*) as total FROM bans'),
      query('SELECT COUNT(*) as total FROM clients')
    ]);

    const conteosAntes = {
      subscribers: parseInt(antes[0][0].total),
      bans: parseInt(antes[1][0].total),
      clients: parseInt(antes[2][0].total)
    };

    console.log(`  📊 Suscriptores: ${conteosAntes.subscribers}`);
    console.log(`  📊 BANs: ${conteosAntes.bans}`);
    console.log(`  📊 Clientes: ${conteosAntes.clients}`);
    console.log(`  📊 TOTAL: ${conteosAntes.subscribers + conteosAntes.bans + conteosAntes.clients} registros`);
    console.log('');

    if (conteosAntes.subscribers === 0 && conteosAntes.bans === 0 && conteosAntes.clients === 0) {
      console.log('✓ La BD ya está vacía');
      return;
    }

    // Borrar en orden
    console.log('[2/4] Borrando registros...');
    await query('DELETE FROM subscribers');
    console.log(`  ✓ Suscriptores eliminados`);
    
    await query('DELETE FROM bans');
    console.log(`  ✓ BANs eliminados`);
    
    await query('DELETE FROM clients');
    console.log(`  ✓ Clientes eliminados`);

    // Contar después
    console.log('');
    console.log('[3/4] Verificación DESPUÉS de borrar...');
    const despues = await Promise.all([
      query('SELECT COUNT(*) as total FROM subscribers'),
      query('SELECT COUNT(*) as total FROM bans'),
      query('SELECT COUNT(*) as total FROM clients')
    ]);

    const conteosDespues = {
      subscribers: parseInt(despues[0][0].total),
      bans: parseInt(despues[1][0].total),
      clients: parseInt(despues[2][0].total)
    };

    console.log(`  📊 Suscriptores: ${conteosDespues.subscribers}`);
    console.log(`  📊 BANs: ${conteosDespues.bans}`);
    console.log(`  📊 Clientes: ${conteosDespues.clients}`);
    
    const totalDespues = conteosDespues.subscribers + conteosDespues.bans + conteosDespues.clients;
    
    if (totalDespues === 0) {
      console.log('');
      console.log('✅ ✅ ✅ BD COMPLETAMENTE VACÍA ✅ ✅ ✅');
    } else {
      console.log('');
      console.log(`⚠️ Aún quedan ${totalDespues} registros`);
    }

    console.log('');
    console.log('[4/4] Listo para importar');
    console.log('===================================================');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

borrarDatos().catch(console.error);

