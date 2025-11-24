import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  ssl: false // Assuming no SSL required or self-signed, adjust if needed
});

async function checkConnection() {
  try {
    console.log('Intentando conectar a la base de datos...');
    const client = await pool.connect();
    console.log('¡Conexión exitosa!');
    
    // Inspect constraints for clients, bans, subscribers
    const tables = ['clients', 'bans', 'subscribers'];
    
    for (const table of tables) {
        console.log(`\n--- Constraints for table: ${table} ---`);
        const res = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = '${table}'::regclass
            AND n.nspname = 'public';
        `);
        
        res.rows.forEach(row => {
            console.log(`- ${row.conname}: ${row.def}`);
        });
        
        // Also check indexes just in case
        console.log(`--- Indexes for table: ${table} ---`);
        const resIndexes = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = '${table}'
            AND schemaname = 'public';
        `);
        resIndexes.rows.forEach(row => {
            console.log(`- ${row.indexname}: ${row.indexdef}`);
        });
    }

    client.release();
  } catch (err) {
    console.error('Error conectando a la base de datos:', err);
  } finally {
    await pool.end();
  }
}

checkConnection();
