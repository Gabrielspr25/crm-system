const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function buscarPymesNegocios() {
  try {
    console.log('🔍 Buscando tipos relacionados a PYMES/Negocios...\n');

    // Buscar cualquier tipo con palabras clave
    const query = `
      SELECT 
        ventatipoid,
        nombre,
        activo,
        (SELECT COUNT(*) FROM venta v WHERE v.ventatipoid = vt.ventatipoid) as total_ventas
      FROM ventatipo vt
      WHERE LOWER(nombre) LIKE '%pyme%'
         OR LOWER(nombre) LIKE '%sme%'
         OR LOWER(nombre) LIKE '%negocio%'
         OR LOWER(nombre) LIKE '%business%'
         OR LOWER(nombre) LIKE '%corporat%'
         OR LOWER(nombre) LIKE '%empres%'
      ORDER BY ventatipoid
    `;

    const result = await legacyPool.query(query);

    if (result.rows.length > 0) {
      console.log('📋 TIPOS RELACIONADOS A PYMES/NEGOCIOS ENCONTRADOS:');
      console.table(result.rows);

      // Contar ventas totales
      const totalVentas = result.rows.reduce((sum, row) => sum + parseInt(row.total_ventas || 0), 0);
      console.log(`\n📊 Total ventas con estos tipos: ${totalVentas.toLocaleString()}`);

    } else {
      console.log('❌ NO se encontraron tipos con esas palabras clave\n');
    }

    // Listar TODOS los tipos con alguna venta (top 20)
    console.log('\n📋 TOP 20 TIPOS MÁS USADOS (con ventas):');
    const topQuery = `
      SELECT 
        vt.ventatipoid,
        vt.nombre,
        COUNT(v.ventaid) as total_ventas,
        vt.activo
      FROM ventatipo vt
      LEFT JOIN venta v ON v.ventatipoid = vt.ventatipoid
      WHERE v.activo = true
      GROUP BY vt.ventatipoid, vt.nombre, vt.activo
      ORDER BY total_ventas DESC
      LIMIT 20
    `;

    const topResult = await legacyPool.query(topQuery);
    console.table(topResult.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await legacyPool.end();
  }
}

buscarPymesNegocios();
