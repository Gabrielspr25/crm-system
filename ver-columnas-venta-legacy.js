import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

async function verColumnas() {
  try {
    console.log('\n=== COLUMNAS DE TABLA VENTA (LEGACY) ===\n');
    
    const cols = await legacyPool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'venta'
      ORDER BY ordinal_position
    `);
    
    console.log(`Total: ${cols.rows.length} columnas\n`);
    
    cols.rows.forEach((col, i) => {
      const len = col.character_maximum_length ? ` (${col.character_maximum_length})` : '';
      console.log(`${(i+1).toString().padStart(2, '0')}. ${col.column_name.padEnd(35, ' ')} ${col.data_type}${len}`);
    });

    // Buscar columnas relacionadas a precio/valor
    console.log('\n=== COLUMNAS QUE PODRÍAN SER VALOR/PRECIO ===\n');
    const related = cols.rows.filter(c => 
      c.column_name.toLowerCase().includes('precio') ||
      c.column_name.toLowerCase().includes('valor') ||
      c.column_name.toLowerCase().includes('comision') ||
      c.column_name.toLowerCase().includes('mensual') ||
      c.column_name.toLowerCase().includes('renta') ||
      c.column_name.toLowerCase().includes('plan') ||
      c.column_name.toLowerCase().includes('soc')
    );
    
    related.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type})`);
    });

    // Ver muestra de datos
    console.log('\n=== MUESTRA DE DATOS (3 registros) ===\n');
    const sample = await legacyPool.query(`
      SELECT * FROM venta WHERE ban IS NOT NULL LIMIT 3
    `);
    
    if (sample.rows.length > 0) {
      console.log(`Registro 1 (BAN: ${sample.rows[0].ban}):`);
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

verColumnas();
