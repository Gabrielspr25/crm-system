const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function verificarTiposPymes() {
  try {
    console.log('🔍 Verificando tipos PYMES en ventatipo...\n');

    const query = `
      SELECT 
        ventatipoid,
        nombre,
        activo
      FROM ventatipo
      WHERE ventatipoid IN (138, 139, 140, 141)
      ORDER BY ventatipoid
    `;

    const result = await legacyPool.query(query);

    console.log('📋 TIPOS PYMES EN TABLA ventatipo:');
    console.table(result.rows);

    if (result.rows.length > 0) {
      console.log('\n✅ Los tipos PYMES existen en la tabla');
      
      // Ahora buscar si hay ALGUNA venta con estos tipos
      const ventasQuery = `
        SELECT COUNT(*) as total
        FROM venta
        WHERE ventatipoid IN (138, 139, 140, 141)
      `;
      const ventasResult = await legacyPool.query(ventasQuery);
      console.log(`\n📊 Ventas con estos tipos: ${ventasResult.rows[0].total}`);

      // Buscar en ventapyme si hay datos
      const ventapymeQuery = `
        SELECT COUNT(*) as total
        FROM ventapyme
        WHERE ventatipoid IN (138, 139, 140, 141)
      `;
      const ventapymeResult = await legacyPool.query(ventapymeQuery);
      console.log(`📊 Ventas en ventapyme: ${ventapymeResult.rows[0].total}`);

    } else {
      console.log('\n❌ Los tipos PYMES NO existen en la tabla');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await legacyPool.end();
  }
}

verificarTiposPymes();
