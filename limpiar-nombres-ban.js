// Script para limpiar nombres/empresas auto-generados (BAN) en la BD
// Esto moverá esos clientes a "Incompletos"

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Query ejecutado', { text, duration, rows: res.rowCount });
    return res.rows;
  } catch (error) {
    console.error('❌ Error en query', { text, error: error.message });
    throw error;
  }
}

async function limpiarNombresBAN() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('\n🔍 Verificando clientes con nombre/empresa BAN...\n');
    
    // 1. Contar cuántos hay
    const antes = await client.query(`
      SELECT 
        COUNT(*) as total_con_nombre_ban,
        COUNT(CASE WHEN name LIKE 'Cliente BAN %' OR name LIKE 'BAN %' THEN 1 END) as con_nombre_ban,
        COUNT(CASE WHEN business_name LIKE 'Empresa BAN %' OR business_name LIKE 'BAN %' THEN 1 END) as con_empresa_ban
      FROM clients
      WHERE (name LIKE 'Cliente BAN %' OR name LIKE 'BAN %' OR 
             business_name LIKE 'Empresa BAN %' OR business_name LIKE 'BAN %')
    `);
    
    const conteos = antes[0];
    console.log('📊 Clientes encontrados con nombre/empresa BAN:');
    console.log('  - Total:', conteos.total_con_nombre_ban);
    console.log('  - Con nombre "Cliente BAN ...":', conteos.con_nombre_ban);
    console.log('  - Con empresa "Empresa BAN ...":', conteos.con_empresa_ban);
    
    if (parseInt(conteos.total_con_nombre_ban) === 0) {
      console.log('\n✅ No hay clientes con nombre/empresa BAN para limpiar');
      await client.query('COMMIT');
      return;
    }
    
    // 2. Actualizar: poner business_name en NULL
    console.log('\n🔄 Limpiando business_name de esos clientes...');
    const resultado = await client.query(`
      UPDATE clients
      SET business_name = NULL,
          updated_at = NOW()
      WHERE (name LIKE 'Cliente BAN %' OR name LIKE 'BAN %' OR 
             business_name LIKE 'Empresa BAN %' OR business_name LIKE 'BAN %')
    `);
    
    console.log(`✅ ${resultado.rowCount} clientes actualizados (business_name = NULL)`);
    
    // 3. Verificar
    const despues = await client.query(`
      SELECT COUNT(*) as total_actualizados
      FROM clients
      WHERE business_name IS NULL 
        AND (name LIKE 'Cliente BAN %' OR name LIKE 'BAN %')
    `);
    
    console.log('\n✅ Verificación:', despues[0].total_actualizados, 'clientes ahora tienen business_name = NULL');
    console.log('\n✅ Estos clientes ahora aparecerán en "Incompletos"');
    
    await client.query('COMMIT');
    
    console.log('\n✅ ===== LIMPIEZA COMPLETADA =====\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

limpiarNombresBAN()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });


