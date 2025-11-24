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

async function verifyCounts() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    console.log('¡Conectado!');

    const tables = ['clients', 'bans', 'subscribers'];
    const counts = {};

    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = parseInt(res.rows[0].count, 10);
    }

    console.log('\n--- CONTEO DE REGISTROS ---');
    console.log(`Clientes:     ${counts.clients}`);
    console.log(`BANs:         ${counts.bans}`);
    console.log(`Suscriptores: ${counts.subscribers}`);
    console.log('---------------------------');

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

verifyCounts();
