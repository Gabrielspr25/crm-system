import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

async function verEstructuraVenta() {
  try {
    console.log('\n=== ESTRUCTURA TABLA VENTA (LEGACY) ===\n');
    
    const columns = await legacyPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'venta'
      ORDER BY ordinal_position
    `);
    
    columns.rows.forEach(col => {
      console.log(`${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n=== BUSCAR VENTA BAN 719400825 ===\n');
    
    const venta = await legacyPool.query(`
      SELECT * FROM venta WHERE ban = $1 LIMIT 1
    `, ['719400825']);
    
    if (venta.rows.length > 0) {
      const v = venta.rows[0];
      console.log('DATOS ENCONTRADOS:');
      console.log(`BAN: ${v.ban}`);
      console.log(`Código Voz: ${v.codigovoz || 'N/A'}`);
      console.log(`Meses: ${v.meses || 'N/A'}`);
      
      // Buscar campos que podrían ser valor mensual
      const posiblesCampos = Object.keys(v).filter(k => 
        k.toLowerCase().includes('precio') || 
        k.toLowerCase().includes('valor') ||
        k.toLowerCase().includes('mensual') ||
        k.toLowerCase().includes('renta') ||
        k.toLowerCase().includes('plan')
      );
      
      console.log('\n=== CAMPOS RELACIONADOS A PRECIO/VALOR ===');
      posiblesCampos.forEach(campo => {
        console.log(`${campo}: ${v[campo]}`);
      });
      
    } else {
      console.log('❌ Venta no encontrada');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

verEstructuraVenta();
