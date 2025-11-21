// Script para BORRAR datos de la BD - Usando EXACTAMENTE las mismas credenciales que server-FINAL.js
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

async function crearPool() {
  // Usar EXACTAMENTE las mismas credenciales que server-FINAL.js
  // El servidor funciona con crm_user, así que este script también debe funcionar
  console.log('📋 Variables de entorno:');
  console.log(`  DB_HOST: ${process.env.DB_HOST}`);
  console.log(`  DB_PORT: ${process.env.DB_PORT}`);
  console.log(`  DB_NAME: ${process.env.DB_NAME}`);
  console.log(`  DB_USER: ${process.env.DB_USER}`);
  console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'undefined'}`);
  console.log('');
  
  // Forzar uso de crm_user directamente
  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'crm_pro',
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
    max: 10,
    idleTimeoutMillis: 30_000
  });
  
  // Test de conexión y verificar usuario
  try {
    const test = await pool.connect();
    const userInfo = await test.query('SELECT current_user, current_database()');
    test.release();
    console.log(`✅ Conectado con usuario: ${userInfo.rows[0].current_user}`);
    console.log(`✅ Base de datos: ${userInfo.rows[0].current_database}`);
    return pool;
  } catch (error) {
    console.error(`❌ Error de conexión con crm_user: ${error.message}`);
    throw error;
  }
}

async function borrarDatos() {
  const pool = await crearPool();
  const client = await pool.connect();
  
  try {
    console.log('\n===================================================');
    console.log('  ⚠️  BORRANDO DATOS DE LA BD  ⚠️');
    console.log('===================================================');
    console.log('');
    console.log(`Conectado a: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'crm_pro'}`);
    console.log('');

    // Verificar conexión con una query simple
    console.log('[0/4] Verificando conexión...');
    try {
      const test = await client.query('SELECT current_database(), current_user, current_schema()');
      console.log(`  ✅ BD: ${test.rows[0].current_database}`);
      console.log(`  ✅ Usuario: ${test.rows[0].current_user}`);
      console.log(`  ✅ Schema: ${test.rows[0].current_schema}`);
    } catch (error) {
      console.log(`  ❌ Error de conexión: ${error.message}`);
      throw error;
    }

    // Listar TODAS las tablas disponibles
    console.log('');
    console.log('[0.5/4] Buscando tablas...');
    let todasTablas;
    try {
      todasTablas = await client.query(`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);
      
      if (todasTablas.rows.length === 0) {
        console.log('  ⚠️ No se encontraron tablas en schema public');
        // Intentar otros schemas
        const otrosSchemas = await client.query(`
          SELECT DISTINCT schemaname 
          FROM pg_tables 
          ORDER BY schemaname
        `);
        if (otrosSchemas.rows.length > 0) {
          console.log('  📋 Schemas disponibles:', otrosSchemas.rows.map(r => r.schemaname).join(', '));
        }
      } else {
        console.log(`  📋 Tablas encontradas: ${todasTablas.rows.map(r => r.tablename).join(', ')}`);
      }
    } catch (error) {
      console.log(`  ⚠️ No se puede listar tablas: ${error.message}`);
      todasTablas = { rows: [] };
    }

    // Intentar contar DIRECTAMENTE (ignorar pg_tables si falla)
    console.log('');
    console.log('[1/4] Contando registros ANTES de borrar...');
    const conteosAntes = { subscribers: 0, bans: 0, clients: 0 };
    let tablasEncontradas = { subscribers: null, bans: null, clients: null };
    
    // Intentar DIRECTAMENTE con los nombres exactos que usa el servidor
    const tablasExactas = ['subscribers', 'bans', 'clients'];
    
    for (const tabla of tablasExactas) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${tabla}`);
        const total = parseInt(result.rows[0].total);
        
        if (tabla === 'subscribers') {
          conteosAntes.subscribers = total;
          tablasEncontradas.subscribers = tabla;
          console.log(`  📊 ${tabla}: ${total} registros`);
        } else if (tabla === 'bans') {
          conteosAntes.bans = total;
          tablasEncontradas.bans = tabla;
          console.log(`  📊 ${tabla}: ${total} registros`);
        } else if (tabla === 'clients') {
          conteosAntes.clients = total;
          tablasEncontradas.clients = tabla;
          console.log(`  📊 ${tabla}: ${total} registros`);
        }
      } catch (e) {
        console.log(`  ⚠️ No se pudo contar ${tabla}: ${e.message}`);
      }
    }

    const totalAntes = conteosAntes.subscribers + conteosAntes.bans + conteosAntes.clients;
    console.log(`  📊 TOTAL: ${totalAntes} registros`);
    console.log('');
    
    if (totalAntes === 0) {
      console.log('✓ La BD ya está vacía');
      return;
    }

    // Borrar en orden (respetando foreign keys)
    console.log('[2/4] Borrando registros...');
    
    // 1. Primero suscriptores (depende de bans)
    if (tablasEncontradas.subscribers) {
      try {
        const resultadoSubs = await client.query(`DELETE FROM ${tablasEncontradas.subscribers}`);
        console.log(`  ✓ ${tablasEncontradas.subscribers}: ${resultadoSubs.rowCount} eliminados`);
      } catch (error) {
        console.log(`  ❌ Error borrando ${tablasEncontradas.subscribers}: ${error.message}`);
      }
    }
    
    // 2. Luego bans (depende de clients)
    if (tablasEncontradas.bans) {
      try {
        const resultadoBans = await client.query(`DELETE FROM ${tablasEncontradas.bans}`);
        console.log(`  ✓ ${tablasEncontradas.bans}: ${resultadoBans.rowCount} eliminados`);
      } catch (error) {
        console.log(`  ❌ Error borrando ${tablasEncontradas.bans}: ${error.message}`);
      }
    }
    
    // 3. Finalmente clients
    if (tablasEncontradas.clients) {
      try {
        const resultadoClients = await client.query(`DELETE FROM ${tablasEncontradas.clients}`);
        console.log(`  ✓ ${tablasEncontradas.clients}: ${resultadoClients.rowCount} eliminados`);
      } catch (error) {
        console.log(`  ❌ Error borrando ${tablasEncontradas.clients}: ${error.message}`);
      }
    }

    // Verificar que quedó vacío
    console.log('');
    console.log('[3/4] Verificación DESPUÉS de borrar...');
    const conteosDespues = { subscribers: 0, bans: 0, clients: 0 };
    
    if (tablasEncontradas.subscribers) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${tablasEncontradas.subscribers}`);
        conteosDespues.subscribers = parseInt(result.rows[0].total);
      } catch (e) {}
    }
    
    if (tablasEncontradas.bans) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${tablasEncontradas.bans}`);
        conteosDespues.bans = parseInt(result.rows[0].total);
      } catch (e) {}
    }
    
    if (tablasEncontradas.clients) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${tablasEncontradas.clients}`);
        conteosDespues.clients = parseInt(result.rows[0].total);
      } catch (e) {}
    }
    
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
    client.release();
    await pool.end();
  }
}

borrarDatos().catch(console.error);
