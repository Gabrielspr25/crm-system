
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'crm_user',
  host: '143.244.191.139',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
  ssl: false
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔍 Buscando clientes para mover a "Incompletos" (Nombre = BAN)...');

    // Verificar cuántos coinciden antes de actualizar
    const checkRes = await client.query(`
      SELECT COUNT(*) as count
      FROM clients c
      JOIN bans b ON c.id = b.client_id
      WHERE c.name = b.ban_number
      AND (c.business_name IS NULL OR c.business_name = '')
    `);

    const count = parseInt(checkRes.rows[0].count);
    console.log(`📋 Se encontraron ${count} clientes donde el Nombre es igual al BAN.`);

    if (count > 0) {
      console.log('🔄 Actualizando clientes (Nombre -> NULL)...');
      
      const updateRes = await client.query(`
        UPDATE clients c
        SET name = '', business_name = '', updated_at = NOW()
        FROM bans b
        WHERE c.id = b.client_id
        AND c.name = b.ban_number
        AND (c.business_name IS NULL OR c.business_name = '')
      `);

      console.log(`✅ ${updateRes.rowCount} clientes actualizados.`);
      console.log('   Ahora aparecerán con la celda de nombre en blanco y en la pestaña "Incompletos".');
    } else {
      console.log('⚠️ No se encontraron clientes para actualizar.');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
