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

async function checkIncomplete() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    
    // 1. Clientes sin BANs
    const clientsNoBan = await client.query(`
      SELECT count(*) as count 
      FROM clients c
      LEFT JOIN bans b ON c.id = b.client_id
      WHERE b.id IS NULL
    `);
    
    // 2. Clientes con BANs pero sin Suscriptores
    const clientsBanNoSub = await client.query(`
      SELECT count(DISTINCT c.id) as count
      FROM clients c
      JOIN bans b ON c.id = b.client_id
      LEFT JOIN subscribers s ON b.id = s.ban_id
      WHERE s.id IS NULL
    `);

    console.log('\n--- ANÁLISIS DE INCOMPLETOS ---');
    console.log(`Clientes sin BANs: ${clientsNoBan.rows[0].count}`);
    console.log(`Clientes con BANs pero sin Suscriptores: ${clientsBanNoSub.rows[0].count}`);
    
    const totalIncompletos = parseInt(clientsNoBan.rows[0].count) + parseInt(clientsBanNoSub.rows[0].count);
    console.log(`Total Incompletos en BD: ${totalIncompletos}`);

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkIncomplete();
