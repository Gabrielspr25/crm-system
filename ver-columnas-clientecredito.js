import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

async function verEstructura() {
  try {
    console.log('\n=== COLUMNAS DE clientecredito ===\n');
    
    const cols = await legacyPool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'clientecredito'
      ORDER BY ordinal_position
    `);
    
    cols.rows.forEach(c => {
      console.log(`  ${c.column_name} (${c.data_type})`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

verEstructura();
