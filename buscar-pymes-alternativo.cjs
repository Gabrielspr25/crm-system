const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function buscarPymesAlternativo() {
  try {
    console.log('🔍 BUSCANDO PYMES POR MÉTODOS ALTERNATIVOS\n');

    // 1. Por nombre del cliente (Inc, Corp, LLC, Ltd, etc.)
    console.log('📊 1. CLIENTES CON NOMBRES CORPORATIVOS:');
    const nombresCorporativosQuery = `
      SELECT 
        COUNT(DISTINCT v.ventaid) as total_ventas,
        COUNT(DISTINCT cc.clientecreditoid) as clientes_unicos,
        SUM(v.comisionclaro) as comision_total
      FROM venta v
      INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.activo = true
        AND (
          UPPER(cc.nombre) LIKE '%CORP%'
          OR UPPER(cc.nombre) LIKE '%INC%'
          OR UPPER(cc.nombre) LIKE '%LLC%'
          OR UPPER(cc.nombre) LIKE '%LTD%'
          OR UPPER(cc.nombre) LIKE '%SA%'
          OR UPPER(cc.nombre) LIKE '%EMPRESA%'
          OR UPPER(cc.nombre) LIKE '%COMPANY%'
          OR UPPER(cc.nombre) LIKE '%BUSINESS%'
          OR UPPER(cc.nombre) LIKE '%NEGOCIO%'
        )
    `;
    const corporativos = await legacyPool.query(nombresCorporativosQuery);
    console.table(corporativos.rows);

    if (parseInt(corporativos.rows[0].total_ventas) > 0) {
      console.log('\n📄 SAMPLE 10 VENTAS CORPORATIVAS:');
      const sampleCorp = await legacyPool.query(`
        SELECT 
          v.ventaid,
          cc.nombre,
          v.fechaactivacion,
          v.ban,
          v.comisionclaro,
          v.fijo
        FROM venta v
        INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
        WHERE v.activo = true
          AND (
            UPPER(cc.nombre) LIKE '%CORP%'
            OR UPPER(cc.nombre) LIKE '%INC%'
            OR UPPER(cc.nombre) LIKE '%LLC%'
          )
        ORDER BY v.fechaactivacion DESC
        LIMIT 10
      `);
      console.table(sampleCorp.rows);
    }

    // 2. Por clasificacioncredito
    console.log('\n📊 2. CLASIFICACIONES DE CRÉDITO ÚNICAS:');
    const clasificacionQuery = `
      SELECT 
        cc.clasificacioncredito,
        COUNT(DISTINCT v.ventaid) as total_ventas,
        COUNT(DISTINCT cc.clientecreditoid) as clientes_unicos
      FROM venta v
      INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.activo = true
        AND cc.clasificacioncredito IS NOT NULL
      GROUP BY cc.clasificacioncredito
      ORDER BY total_ventas DESC
    `;
    const clasificaciones = await legacyPool.query(clasificacionQuery);
    console.table(clasificaciones.rows);

    // 3. Por lineacredito o lineas aprobadas (empresas tienen más líneas)
    console.log('\n📊 3. CLIENTES CON MÚLTIPLES LÍNEAS (posible corporativo):');
    const multiLineasQuery = `
      SELECT 
        COUNT(DISTINCT v.ventaid) as total_ventas,
        COUNT(DISTINCT cc.clientecreditoid) as clientes_unicos,
        AVG(cc.lineasaprobadas) as avg_lineas,
        SUM(v.comisionclaro) as comision_total
      FROM venta v
      INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.activo = true
        AND cc.lineasaprobadas >= 5
    `;
    const multiLineas = await legacyPool.query(multiLineasQuery);
    console.table(multiLineas.rows);

    // 4. Explorar vendedores específicos
    console.log('\n📊 4. VENDEDORES CON MÁS VENTAS (pueden ser especialistas PYMES):');
    const vendedoresQuery = `
      SELECT 
        vd.vendedorid,
        vd.nombre as vendedor_nombre,
        COUNT(v.ventaid) as total_ventas,
        SUM(v.comisionclaro) as comision_total
      FROM venta v
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      WHERE v.activo = true
      GROUP BY vd.vendedorid, vd.nombre
      ORDER BY total_ventas DESC
      LIMIT 15
    `;
    const vendedores = await legacyPool.query(vendedoresQuery);
    console.table(vendedores.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

buscarPymesAlternativo();
