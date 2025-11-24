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

async function checkProspects() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    
    const res = await client.query(`
      SELECT count(*) as count FROM follow_up_prospects WHERE is_active = true AND is_completed = false
    `);
    
    console.log(`Prospectos activos: ${res.rows[0].count}`);
    
    if (res.rows[0].count > 0) {
        const details = await client.query(`
            SELECT p.id, c.name, c.business_name, u.name as vendedor
            FROM follow_up_prospects p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN users u ON p.vendor_id = u.id
            WHERE p.is_active = true AND p.is_completed = false
            LIMIT 5
        `);
        console.log('Detalles de prospectos activos:', details.rows);
    }

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkProspects();
