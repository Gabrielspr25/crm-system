const { Pool } = require('pg');

const tango = new Pool({
  host: '167.99.12.125', port: 5432,
  database: 'claropr', user: 'postgres',
  password: 'fF00JIRFXc',
  connectionTimeoutMillis: 10000
});

async function main() {
  try {
    // La lógica de Tango: tabla COMISION vincula por ventatipoid + meses + rango de rate
    
    // 1. Buscar comision para ventatipoid=141 (PYMES Fijo NEW) 
    console.log('=== COMISIONES para ventatipoid=141 (PYMES Fijo NEW) ===');
    const com141 = await tango.query(`
      SELECT * FROM comision WHERE ventatipoid = 141 ORDER BY ratemin
    `);
    console.dir(com141.rows, { depth: null });

    // 2. Buscar comision para ventatipoid=140 (PYMES Fijo REN)
    console.log('\n=== COMISIONES para ventatipoid=140 (PYMES Fijo REN) ===');
    const com140 = await tango.query(`
      SELECT * FROM comision WHERE ventatipoid = 140 ORDER BY ratemin
    `);
    console.dir(com140.rows, { depth: null });

    // 3. Buscar comision para ventatipoid=138 (PYMES Update REN)
    console.log('\n=== COMISIONES para ventatipoid=138 (PYMES Update REN) ===');
    const com138 = await tango.query(`
      SELECT * FROM comision WHERE ventatipoid = 138 ORDER BY ratemin
    `);
    console.dir(com138.rows, { depth: null });

    // 4. Buscar comision para ventatipoid=139 (PYMES Update NEW)
    console.log('\n=== COMISIONES para ventatipoid=139 (PYMES Update NEW) ===');
    const com139 = await tango.query(`
      SELECT * FROM comision WHERE ventatipoid = 139 ORDER BY ratemin
    `);
    console.dir(com139.rows, { depth: null });

    // 5. Para ventaid 79582: ventatipoid=141, meses=24, plan=A881 54.99 (rate ~54.99)
    console.log('\n=== SIMULAR: ¿Qué comision le toca a ventaid 79582? ===');
    console.log('Parámetros: ventatipoid=141, meses=24, rate del plan=54.99');
    const match = await tango.query(`
      SELECT * FROM comision
      WHERE ventatipoid = 141
        AND (meses = 24 OR meses = 0)
        AND ratemin <= 54.99 AND ratemax >= 54.99
        AND fechadesde <= '2025-01-23' AND fechahasta >= '2025-01-23'
      ORDER BY fechadesde DESC
    `);
    console.log(`Registros encontrados: ${match.rowCount}`);
    if (match.rowCount > 0) {
      console.dir(match.rows, { depth: null });
    } else {
      console.log('NO HAY MATCH → por eso comisionclaro = NULL en esta venta');
    }

    // 6. ¿Cuál es el rate de tipoplan para A881 54.99?
    console.log('\n=== tipoplan para codigovoz A881 ===');
    const tp = await tango.query(`
      SELECT tipoplanid, codigovoz, rate, comisionclaro, activo
      FROM tipoplan
      WHERE codigovoz ILIKE '%A881%'
    `);
    console.table(tp.rows);

    // 7. Verificar cómo las ventas CON comisionclaro hacen el match
    console.log('\n=== MATCH para ventas CON comisionclaro > 0 (top 10) ===');
    const verified = await tango.query(`
      SELECT v.ventaid, v.ventatipoid, v.meses, v.codigovoz, v.comisionclaro as venta_comision,
             tp.rate as plan_rate,
             c.comisionclaro as comision_tabla, c.ratemin, c.ratemax, c.meses as com_meses,
             c.fechadesde, c.fechahasta
      FROM venta v
      LEFT JOIN tipoplan tp ON tp.codigovoz = v.codigovoz
      LEFT JOIN comision c ON c.ventatipoid = v.ventatipoid
        AND (c.meses = v.meses::bigint OR c.meses = 0)
        AND tp.rate::numeric >= c.ratemin AND tp.rate::numeric <= c.ratemax
        AND v.fechaactivacion >= c.fechadesde AND v.fechaactivacion <= c.fechahasta
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
        AND v.comisionclaro > 0
      ORDER BY v.ventaid
      LIMIT 10
    `);
    console.table(verified.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await tango.end();
  }
}

main();
