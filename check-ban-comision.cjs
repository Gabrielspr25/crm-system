const { Pool } = require('pg');

const tango = new Pool({
  host: '167.99.12.125', port: 5432,
  database: 'claropr', user: 'postgres',
  password: 'fF00JIRFXc',
  connectionTimeoutMillis: 10000
});

async function main() {
  try {
    // 1. Todas las ventas del BAN 784175066
    console.log('=== VENTAS BAN 784175066 ===');
    const ventas = await tango.query(`
      SELECT v.ventaid, v.ban, v.status as linea, v.ventatipoid, v.meses,
             v.fechaactivacion, v.comisionclaro, v.comisionvendedor,
             v.codigovoz, v.activo, v.renovacion, v.fijo,
             vt.nombre as tipo_nombre,
             cc.nombre as cliente
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      WHERE v.ban = '784175066'
      ORDER BY v.ventaid
    `);
    console.dir(ventas.rows, { depth: null });

    // 2. Para CADA venta, simular el lookup de comisión
    for (const v of ventas.rows) {
      console.log(`\n--- Lookup comision para ventaid=${v.ventaid} ---`);
      console.log(`  ventatipoid=${v.ventatipoid}, meses=${v.meses}, fecha=${v.fechaactivacion}`);
      console.log(`  codigovoz=${v.codigovoz}`);
      
      // Buscar rate del plan en tipoplan
      const tp = await tango.query(`
        SELECT tipoplanid, codigovoz, rate FROM tipoplan WHERE codigovoz = $1
      `, [v.codigovoz]);
      
      if (tp.rowCount > 0) {
        const rate = parseFloat(tp.rows[0].rate);
        console.log(`  rate del plan: ${rate} (tipoplanid=${tp.rows[0].tipoplanid})`);
        
        // Buscar comision match
        const com = await tango.query(`
          SELECT comisionid, comisionclaro, meses, ratemin, ratemax, fechadesde, fechahasta
          FROM comision
          WHERE ventatipoid = $1
            AND ratemin <= $2 AND ratemax >= $2
          ORDER BY fechadesde DESC
        `, [v.ventatipoid, rate]);
        
        if (com.rowCount > 0) {
          console.log(`  Comisiones encontradas (${com.rowCount}):`);
          for (const c of com.rows) {
            const fechaAct = new Date(v.fechaactivacion);
            const desde = new Date(c.fechadesde);
            const hasta = new Date(c.fechahasta);
            const matchMeses = (c.meses === '0' || c.meses === v.meses);
            const matchFecha = (fechaAct >= desde && fechaAct <= hasta);
            console.log(`    comisionid=${c.comisionid}: $${c.comisionclaro} | meses=${c.meses} (match=${matchMeses}) | rango=[${c.ratemin}-${c.ratemax}] | fecha=[${c.fechadesde?.toISOString().slice(0,10)} a ${c.fechahasta?.toISOString().slice(0,10)}] (match=${matchFecha})`);
          }
        } else {
          console.log(`  ❌ NO hay comision para ventatipoid=${v.ventatipoid} con rate=${rate}`);
        }
      } else {
        console.log(`  ❌ Plan ${v.codigovoz} NO existe en tipoplan`);
        
        // Intentar extraer rate del nombre del codigovoz (ej: "A881 54.99")
        const match = v.codigovoz?.match(/(\d+\.?\d*)\s*$/);
        if (match) {
          const rate = parseFloat(match[1]);
          console.log(`  Extraído rate del nombre: ${rate}`);
          
          const com = await tango.query(`
            SELECT comisionid, comisionclaro, meses, ratemin, ratemax, fechadesde, fechahasta
            FROM comision
            WHERE ventatipoid = $1
              AND ratemin <= $2 AND ratemax >= $2
            ORDER BY fechadesde DESC
          `, [v.ventatipoid, rate]);
          
          if (com.rowCount > 0) {
            console.log(`  Comisiones encontradas (${com.rowCount}):`);
            for (const c of com.rows) {
              const fechaAct = new Date(v.fechaactivacion);
              const desde = new Date(c.fechadesde);
              const hasta = new Date(c.fechahasta);
              const matchMeses = (c.meses === '0' || c.meses === v.meses);
              const matchFecha = (fechaAct >= desde && fechaAct <= hasta);
              console.log(`    comisionid=${c.comisionid}: $${c.comisionclaro} | meses=${c.meses} (match=${matchMeses}) | rango=[${c.ratemin}-${c.ratemax}] | fecha=[${c.fechadesde?.toISOString().slice(0,10)} a ${c.fechahasta?.toISOString().slice(0,10)}] (match=${matchFecha})`);
            }
          } else {
            console.log(`  ❌ Tampoco match por rate extraído ${rate}`);
          }
        }
      }
    }

    // 3. Comisiones disponibles para ventatipoid=141 (PYMES Fijo NEW)
    console.log('\n\n=== TODAS las comisiones para ventatipoid=141 ===');
    const all141 = await tango.query(`
      SELECT comisionid, comisionclaro, meses, ratemin, ratemax, 
             fechadesde, fechahasta
      FROM comision
      WHERE ventatipoid = 141
      ORDER BY ratemin, meses
    `);
    console.table(all141.rows);

    // 4. Verificar: ¿Hay comision para rate=54.99 en ventatipoid=141?
    console.log('\n=== Match EXACTO: ventatipoid=141, rate=54.99 ===');
    const exact = await tango.query(`
      SELECT * FROM comision
      WHERE ventatipoid = 141
        AND ratemin <= 54.99 AND ratemax >= 54.99
    `);
    console.dir(exact.rows, { depth: null });

    // 5. ¿El rate 54.99 cae fuera de algún rango?
    console.log('\n=== Rangos disponibles en ventatipoid=141 ===');
    const ranges = await tango.query(`
      SELECT DISTINCT ratemin, ratemax FROM comision
      WHERE ventatipoid = 141
      ORDER BY ratemin
    `);
    console.table(ranges.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await tango.end();
  }
}

main();
