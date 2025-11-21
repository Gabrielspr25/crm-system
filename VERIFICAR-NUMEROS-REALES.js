// Script para verificar números REALES en la base de datos
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env
dotenv.config({ path: resolve(__dirname, '.env') });

async function verificarNumeros() {
  let client;
  let poolActual;
  
  // Intentar con crm_user primero
  try {
    poolActual = new pg.Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'crm_pro',
      user: process.env.DB_USER || 'crm_user',
      password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
    });
    client = await poolActual.connect();
    console.log('✅ Conectado con crm_user');
  } catch (error) {
    // Si falla, intentar con postgres
    console.log('⚠️ Falló con crm_user, intentando con postgres...');
    try {
      poolActual = new pg.Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'crm_pro',
        user: 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });
      client = await poolActual.connect();
      console.log('✅ Conectado con postgres');
    } catch (error2) {
      console.error('\n❌ ERROR al conectar:', error2.message);
      process.exit(1);
    }
  }
  
  try {
    console.log('\n===================================================');
    console.log('  VERIFICANDO NÚMEROS REALES EN LA BD');
    console.log('===================================================');
    console.log('');

    // 0. Listar todas las tablas disponibles
    const todasLasTablas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('📋 Tablas disponibles en la BD:');
    todasLasTablas.rows.forEach(row => {
      console.log('   -', row.table_name);
    });
    console.log('');

    // 1. Contar CLIENTES (todos, sin filtros)
    const totalClientes = await client.query('SELECT COUNT(*) as total FROM clients');
    const clientesTotal = parseInt(totalClientes.rows[0].total);
    console.log('1. TOTAL CLIENTES (todos):', clientesTotal);

    // 2. Contar BANs (todos, sin filtros)
    const totalBans = await client.query(`
      SELECT COUNT(*) as total 
      FROM bans 
      WHERE COALESCE(is_active, 1) = 1
    `);
    const bansTotal = parseInt(totalBans.rows[0].total);
    console.log('2. TOTAL BANs (activos):', bansTotal);

    // 3. Contar SUSCRIPTORES (todos, sin filtros)
    const totalSuscriptores = await client.query(`
      SELECT COUNT(*) as total 
      FROM subscribers 
      WHERE COALESCE(is_active, 1) = 1
    `);
    const suscriptoresTotal = parseInt(totalSuscriptores.rows[0].total);
    console.log('3. TOTAL SUSCRIPTORES (activos):', suscriptoresTotal);

    // 4. Contar SUSCRIPTORES EN OPORTUNIDAD (remaining_payments = 0)
    const suscriptoresOportunidad = await client.query(`
      SELECT COUNT(*) as total 
      FROM subscribers s
      INNER JOIN bans b ON s.ban_id = b.id
      WHERE COALESCE(s.is_active, 1) = 1 
        AND COALESCE(b.is_active, 1) = 1
        AND COALESCE(s.remaining_payments, 0) = 0
    `);
    const oportunidadTotal = parseInt(suscriptoresOportunidad.rows[0].total);
    console.log('4. SUSCRIPTORES EN OPORTUNIDAD (remaining_payments = 0):', oportunidadTotal);

    // 5. Verificar distribución de BANs por cliente
    const distribucionBans = await client.query(`
      SELECT 
        COUNT(DISTINCT client_id) as clientes_con_bans,
        SUM(ban_count) as total_bans,
        AVG(ban_count) as promedio_bans_por_cliente,
        MAX(ban_count) as max_bans_cliente
      FROM (
        SELECT 
          client_id,
          COUNT(*) as ban_count
        FROM bans
        WHERE COALESCE(is_active, 1) = 1
        GROUP BY client_id
      ) subq
    `);
    console.log('');
    console.log('5. DISTRIBUCIÓN DE BANs:');
    console.log('   - Clientes con BANs:', distribucionBans.rows[0].clientes_con_bans || 0);
    console.log('   - Total BANs:', parseInt(distribucionBans.rows[0].total_bans || 0));
    console.log('   - Promedio BANs por cliente:', parseFloat(distribucionBans.rows[0].promedio_bans_por_cliente || 0).toFixed(2));
    console.log('   - Máximo BANs en un cliente:', distribucionBans.rows[0].max_bans_cliente || 0);

    // 6. Verificar distribución de suscriptores por BAN
    const distribucionSuscriptores = await client.query(`
      SELECT 
        COUNT(DISTINCT ban_id) as bans_con_suscriptores,
        SUM(subscriber_count) as total_suscriptores,
        AVG(subscriber_count) as promedio_suscriptores_por_ban,
        MAX(subscriber_count) as max_suscriptores_ban
      FROM (
        SELECT 
          ban_id,
          COUNT(*) as subscriber_count
        FROM subscribers
        WHERE COALESCE(is_active, 1) = 1
        GROUP BY ban_id
      ) subq
    `);
    console.log('');
    console.log('6. DISTRIBUCIÓN DE SUSCRIPTORES:');
    console.log('   - BANs con suscriptores:', distribucionSuscriptores.rows[0].bans_con_suscriptores || 0);
    console.log('   - Total suscriptores:', parseInt(distribucionSuscriptores.rows[0].total_suscriptores || 0));
    console.log('   - Promedio suscriptores por BAN:', parseFloat(distribucionSuscriptores.rows[0].promedio_suscriptores_por_ban || 0).toFixed(2));
    console.log('   - Máximo suscriptores en un BAN:', distribucionSuscriptores.rows[0].max_suscriptores_ban || 0);

    // 7. Verificar que la suma por cliente coincida con el total directo
    const sumaPorCliente = await client.query(`
      SELECT 
        SUM(ban_count) as suma_bans,
        SUM(subscriber_count) as suma_suscriptores
      FROM (
        SELECT 
          c.id,
          COALESCE(b.ban_count, 0) as ban_count,
          COALESCE(s.subscriber_count, 0) as subscriber_count
        FROM clients c
        LEFT JOIN (
          SELECT client_id, COUNT(*) as ban_count
          FROM bans
          WHERE COALESCE(is_active, 1) = 1
          GROUP BY client_id
        ) b ON b.client_id = c.id
        LEFT JOIN (
          SELECT 
            b.client_id,
            COUNT(DISTINCT s.id) as subscriber_count
          FROM bans b
          INNER JOIN subscribers s ON s.ban_id = b.id
          WHERE COALESCE(b.is_active, 1) = 1 AND COALESCE(s.is_active, 1) = 1
          GROUP BY b.client_id
        ) s ON s.client_id = c.id
      ) subq
    `);
    console.log('');
    console.log('7. VERIFICACIÓN DE SUMAS POR CLIENTE:');
    console.log('   - Suma de ban_count por cliente:', parseInt(sumaPorCliente.rows[0].suma_bans || 0));
    console.log('   - Suma de subscriber_count por cliente:', parseInt(sumaPorCliente.rows[0].suma_suscriptores || 0));
    console.log('');
    console.log('   ✅ Verificación:');
    console.log('   - BANs (directo):', bansTotal);
    console.log('   - BANs (suma por cliente):', parseInt(sumaPorCliente.rows[0].suma_bans || 0));
    console.log('   - Coinciden:', bansTotal === parseInt(sumaPorCliente.rows[0].suma_bans || 0) ? '✅ SÍ' : '❌ NO');
    console.log('   - Suscriptores (directo):', suscriptoresTotal);
    console.log('   - Suscriptores (suma por cliente):', parseInt(sumaPorCliente.rows[0].suma_suscriptores || 0));
    console.log('   - Coinciden:', suscriptoresTotal === parseInt(sumaPorCliente.rows[0].suma_suscriptores || 0) ? '✅ SÍ' : '❌ NO');

    console.log('');
    console.log('===================================================');
    console.log('  📊 NÚMEROS REALES PARA MOSTRAR EN FRONTEND:');
    console.log('===================================================');
    console.log('  1. Cantidad de Clientes:', clientesTotal);
    console.log('  2. Cantidad de BAN:', bansTotal);
    console.log('  3. Cant de Suscriptores:', suscriptoresTotal);
    console.log('  4. Suscriptores en Oportunidad:', oportunidadTotal);
    console.log('===================================================');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    client.release();
    await poolActual.end();
  }
}

verificarNumeros().catch(console.error);
