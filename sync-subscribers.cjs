
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔌 Configuración de conexión:', {
  user: process.env.DB_USER || 'crm_user',
  host: '143.244.191.139',
  database: process.env.DB_NAME || 'crm_pro',
  port: process.env.DB_PORT || 5432,
});

const pool = new Pool({
  user: process.env.DB_USER || 'crm_user',
  host: '143.244.191.139',
  database: process.env.DB_NAME || 'crm_pro',
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function syncSubscribers() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a la base de datos remota.');
    
    // Check distinct statuses
    const banStatuses = await client.query('SELECT DISTINCT status FROM bans');
    console.log('📊 Estados en BANs:', banStatuses.rows.map(r => r.status));

    const subStatuses = await client.query('SELECT DISTINCT status FROM subscribers');
    console.log('📊 Estados en Subscribers:', subStatuses.rows.map(r => r.status));

    // 1. Contar cuántos están desincronizados
    const check = await client.query(`
      SELECT COUNT(*) as count
      FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      WHERE (b.status IN ('cancelado', 'cancelled', 'baja', 'suspended', 'inactive', 'C') 
             OR b.status LIKE 'CANCEL%')
      AND (s.status IS NULL OR s.status NOT IN ('cancelado', 'cancelled', 'baja', 'suspended', 'inactive', 'C'));
    `);
    
    console.log(`⚠️ Se encontraron ${check.rows[0].count} suscriptores activos en BANs cancelados.`);

    if (parseInt(check.rows[0].count) > 0) {
      // 2. Actualizar
      const update = await client.query(`
        UPDATE subscribers
        SET status = 'cancelado'
        FROM bans
        WHERE subscribers.ban_id = bans.id
        AND (bans.status IN ('cancelado', 'cancelled', 'baja', 'suspended', 'inactive', 'C') 
             OR bans.status LIKE 'CANCEL%')
        AND (subscribers.status IS NULL OR subscribers.status NOT IN ('cancelado', 'cancelled', 'baja', 'suspended', 'inactive', 'C'));
      `);
      
      console.log(`✅ Se corrigieron ${update.rowCount} suscriptores.`);
    } else {
      console.log('✨ No se requieren correcciones.');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

syncSubscribers();

