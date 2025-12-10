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

async function testInsert() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    
    console.log('Intentando insertar con base = 0 (integer)...');
    try {
      await client.query(`
        INSERT INTO clients (name, business_name, base)
        VALUES ($1, $2, $3)
      `, ['Test Client', 'Test Business', 0]);
      console.log('✅ Insert exitoso con integer');
    } catch (err) {
      console.error('❌ Error insertando con integer:', err.message);
    }

    console.log('Intentando insertar con base = "0" (string)...');
    try {
      await client.query(`
        INSERT INTO clients (name, business_name, base)
        VALUES ($1, $2, $3)
      `, ['Test Client 2', 'Test Business 2', '0']);
      console.log('✅ Insert exitoso con string');
    } catch (err) {
      console.error('❌ Error insertando con string:', err.message);
    }

    // Clean up
    await client.query(`DELETE FROM clients WHERE name LIKE 'Test Client%'`);

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error general:', err);
    process.exit(1);
  }
}

testInsert();
