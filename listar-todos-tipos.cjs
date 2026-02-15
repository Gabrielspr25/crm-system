const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function listarTodosTipos() {
  try {
    console.log('🔍 Listando TODOS los ventatipoid en la BD...\n');

    const query = `
      SELECT 
        ventatipoid,
        nombre,
        activo,
        (SELECT COUNT(*) FROM venta v WHERE v.ventatipoid = vt.ventatipoid AND v.activo = true) as ventas_activas
      FROM ventatipo vt
      ORDER BY ventatipoid
    `;

    const result = await legacyPool.query(query);

    console.log(`📋 TOTAL TIPOS ENCONTRADOS: ${result.rows.length}\n`);
    console.table(result.rows);

    // Buscar específicamente PYMES en los nombres
    const pymes = result.rows.filter(r => 
      r.nombre && (
        r.nombre.toLowerCase().includes('pyme') ||
        r.nombre.toLowerCase().includes('negocio')
      )
    );

    if (pymes.length > 0) {
      console.log('\n✅ TIPOS CON "PYME" O "NEGOCIO" EN EL NOMBRE:');
      console.table(pymes);
    } else {
      console.log('\n❌ NO se encontraron tipos con "PYME" en el nombre');
    }

    // Verificar rango de IDs
    const ids = result.rows.map(r => parseInt(r.ventatipoid));
    console.log(`\n📊 Rango de IDs: ${Math.min(...ids)} - ${Math.max(...ids)}`);
    console.log(`📊 IDs únicos: ${ids.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

listarTodosTipos();
