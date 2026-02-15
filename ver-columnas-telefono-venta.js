import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

async function verColumnasVenta() {
  try {
    console.log('\n=== COLUMNAS TABLA VENTA ===\n');
    
    const cols = await legacyPool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'venta'
      ORDER BY ordinal_position
    `);
    
    console.log('Columnas relacionadas a teléfono/número:\n');
    const telCols = cols.rows.filter(c => 
      c.column_name.toLowerCase().includes('numero') ||
      c.column_name.toLowerCase().includes('celular') ||
      c.column_name.toLowerCase().includes('telefono') ||
      c.column_name.toLowerCase().includes('movil')
    );
    
    telCols.forEach(c => {
      console.log(`  ${c.column_name} (${c.data_type})`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

verColumnasVenta();
