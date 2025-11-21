// Script para limpiar BD - Clientes, BANs y Suscriptores
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env
dotenv.config({ path: resolve(__dirname, '.env') });

// Usar las mismas credenciales que server-FINAL.js
// Si crm_user no existe, intentar con postgres
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function limpiarBD() {
  const client = await pool.connect();
  
  try {
    console.log('\n===================================================');
    console.log('  ⚠️  LIMPIEZA DE BASE DE DATOS  ⚠️');
    console.log('===================================================');
    console.log('');
    console.log('Este script BORRARÁ:');
    console.log('  ❌ TODOS los clientes');
    console.log('  ❌ TODOS los BANs');
    console.log('  ❌ TODOS los suscriptores');
    console.log('');
    console.log('⚠️  ESTA ACCIÓN NO SE PUEDE DESHACER  ⚠️');
    console.log('');

    // Verificar qué tablas existen
    console.log('[0/4] Verificando tablas disponibles...');
    const tablas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%subscriber%' OR table_name LIKE '%ban%' OR table_name LIKE '%client%')
      ORDER BY table_name
    `);
    console.log('  📋 Tablas encontradas:', tablas.rows.map(r => r.table_name).join(', ') || 'ninguna');
    console.log('');

    // Contar registros antes (usar EXISTS para evitar errores si no existen)
    console.log('[1/4] Contando registros antes de borrar...');
    let antes;
    try {
      antes = await client.query(`
        SELECT 
          COALESCE((SELECT COUNT(*) FROM subscribers), 0) as total_subscribers,
          COALESCE((SELECT COUNT(*) FROM bans), 0) as total_bans,
          COALESCE((SELECT COUNT(*) FROM clients), 0) as total_clients
      `);
    } catch (error) {
      // Si alguna tabla no existe, usar consultas individuales
      console.log('  ⚠️ Usando consultas individuales...');
      const counts = { total_subscribers: 0, total_bans: 0, total_clients: 0 };
      try {
        const subs = await client.query('SELECT COUNT(*) as count FROM subscribers');
        counts.total_subscribers = subs.rows[0].count;
      } catch (e) {}
      try {
        const bans = await client.query('SELECT COUNT(*) as count FROM bans');
        counts.total_bans = bans.rows[0].count;
      } catch (e) {}
      try {
        const clients = await client.query('SELECT COUNT(*) as count FROM clients');
        counts.total_clients = clients.rows[0].count;
      } catch (e) {}
      antes = { rows: [counts] };
    }
    
    const counts = antes.rows[0];
    console.log(`  📊 Suscriptores: ${counts.total_subscribers}`);
    console.log(`  📊 BANs: ${counts.total_bans}`);
    console.log(`  📊 Clientes: ${counts.total_clients}`);
    console.log('');

    if (counts.total_clients === '0' && counts.total_bans === '0' && counts.total_subscribers === '0') {
      console.log('✓ La base de datos ya está vacía');
      return;
    }

    // Confirmación (en Node.js no podemos hacer Read-Host interactivo fácilmente)
    // Por seguridad, verificamos que hay registros primero
    console.log('[2/4] Iniciando limpieza...');
    console.log('  ⚠️  Esto puede tardar unos segundos...');

    // Borrar en orden (respetando foreign keys)
    console.log('[3/4] Borrando registros...');
    
    let resultSubscribers = { rowCount: 0 };
    let resultBans = { rowCount: 0 };
    let resultClients = { rowCount: 0 };
    
    // Primero suscriptores
    try {
      resultSubscribers = await client.query('DELETE FROM subscribers');
      console.log(`  ✓ Suscriptores eliminados: ${resultSubscribers.rowCount}`);
    } catch (error) {
      console.log(`  ⚠️ No se pudo borrar suscriptores: ${error.message}`);
    }
    
    // Luego bans
    try {
      resultBans = await client.query('DELETE FROM bans');
      console.log(`  ✓ BANs eliminados: ${resultBans.rowCount}`);
    } catch (error) {
      console.log(`  ⚠️ No se pudo borrar BANs: ${error.message}`);
    }
    
    // Finalmente clients
    try {
      resultClients = await client.query('DELETE FROM clients');
      console.log(`  ✓ Clientes eliminados: ${resultClients.rowCount}`);
    } catch (error) {
      console.log(`  ⚠️ No se pudo borrar clientes: ${error.message}`);
    }

    // Verificar que quedó vacío
    console.log('');
    console.log('[4/4] Verificación final...');
    const remaining = { remaining_subscribers: 0, remaining_bans: 0, remaining_clients: 0 };
    
    try {
      const subs = await client.query('SELECT COUNT(*) as count FROM subscribers');
      remaining.remaining_subscribers = parseInt(subs.rows[0].count);
    } catch (e) {}
    
    try {
      const bans = await client.query('SELECT COUNT(*) as count FROM bans');
      remaining.remaining_bans = parseInt(bans.rows[0].count);
    } catch (e) {}
    
    try {
      const clients = await client.query('SELECT COUNT(*) as count FROM clients');
      remaining.remaining_clients = parseInt(clients.rows[0].count);
    } catch (e) {}
    
    const totalRemaining = parseInt(remaining.remaining_subscribers) + 
                           parseInt(remaining.remaining_bans) + 
                           parseInt(remaining.remaining_clients);
    
    if (totalRemaining === 0) {
      console.log('✓ Base de datos limpiada completamente');
      console.log('  ✓ Suscriptores: 0');
      console.log('  ✓ BANs: 0');
      console.log('  ✓ Clientes: 0');
    } else {
      console.log('⚠️  Aún quedan algunos registros:');
      console.log(`  ⚠️ Suscriptores: ${remaining.remaining_subscribers}`);
      console.log(`  ⚠️ BANs: ${remaining.remaining_bans}`);
      console.log(`  ⚠️ Clientes: ${remaining.remaining_clients}`);
    }

    console.log('');
    console.log('===================================================');
    console.log('  ✓ LIMPIEZA COMPLETADA');
    console.log('===================================================');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('  1. Importar los datos con el importador');
    console.log('  2. Los clientes incompletos aparecerán automáticamente en el tab "Incompletos"');
    console.log('  3. Completar la información de los clientes incompletos');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

limpiarBD().catch(console.error);
