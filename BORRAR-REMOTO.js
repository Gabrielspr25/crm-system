import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  ssl: false
});

async function borrarRemoto() {
  const client = await pool.connect();
  try {
    console.log('\n===================================================');
    console.log('  ⚠️  BORRANDO DATOS DE LA BD REMOTA (143.244.191.139) ⚠️');
    console.log('===================================================');

    // Contar antes
    const antesSub = await client.query('SELECT COUNT(*) as total FROM subscribers');
    const antesBan = await client.query('SELECT COUNT(*) as total FROM bans');
    const antesCli = await client.query('SELECT COUNT(*) as total FROM clients');
    
    console.log(`\nRegistros ANTES:`);
    console.log(`- Suscriptores: ${antesSub.rows[0].total}`);
    console.log(`- BANs:         ${antesBan.rows[0].total}`);
    console.log(`- Clientes:     ${antesCli.rows[0].total}`);

    console.log('\n[1/3] Borrando Suscriptores...');
    await client.query('DELETE FROM subscribers');
    
    console.log('[2/3] Borrando BANs...');
    await client.query('DELETE FROM bans');
    
    console.log('[3/3] Borrando Clientes...');
    await client.query('DELETE FROM clients');

    // Resetear secuencias (IDs)
    console.log('\n[INFO] Reseteando contadores de ID...');
    await client.query('ALTER SEQUENCE subscribers_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE bans_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE clients_id_seq RESTART WITH 1');

    // Verificar
    const despuesSub = await client.query('SELECT COUNT(*) as total FROM subscribers');
    const despuesBan = await client.query('SELECT COUNT(*) as total FROM bans');
    const despuesCli = await client.query('SELECT COUNT(*) as total FROM clients');

    console.log(`\nRegistros DESPUÉS:`);
    console.log(`- Suscriptores: ${despuesSub.rows[0].total}`);
    console.log(`- BANs:         ${despuesBan.rows[0].total}`);
    console.log(`- Clientes:     ${despuesCli.rows[0].total}`);
    
    console.log('\n✅ BASE DE DATOS LIMPIA Y LISTA.');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

borrarRemoto();
