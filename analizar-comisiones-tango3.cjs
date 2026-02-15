const { Pool } = require('pg');

const tango = new Pool({
  host: '167.99.12.125', port: 5432,
  database: 'claropr', user: 'postgres',
  password: 'fF00JIRFXc',
  connectionTimeoutMillis: 10000
});

async function main() {
  try {
    // 1. Estructura EXACTA de tabla comision
    console.log('=== ESTRUCTURA TABLA comision ===');
    const cols = await tango.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'comision'
      ORDER BY ordinal_position
    `);
    console.table(cols.rows);

    // 2. Primeros registros de comision para ver qué tienen
    console.log('\n=== PRIMEROS 10 REGISTROS comision ===');
    const data = await tango.query(`SELECT * FROM comision LIMIT 10`);
    console.dir(data.rows, { depth: null });

    // 3. Buscar en comision registros que coincidan con codigovoz de ventas PYMES
    console.log('\n=== BUSCAR comision por codigo/nombre PYMES ===');
    const buscar = await tango.query(`
      SELECT * FROM comision
      WHERE nombre ILIKE '%A881%' OR nombre ILIKE '%A886%' 
         OR nombre ILIKE '%BREDP%' OR nombre ILIKE '%BAIC%'
         OR nombre ILIKE '%A872%' OR nombre ILIKE '%A870%'
         OR nombre ILIKE '%A170%' OR nombre ILIKE '%RED3535%'
    `);
    console.log(`Encontrados: ${buscar.rowCount}`);
    if (buscar.rowCount > 0) console.dir(buscar.rows, { depth: null });

    // 4. Buscar con codigo en vez de nombre
    console.log('\n=== BUSCAR por campo codigo ===');
    const busCod = await tango.query(`
      SELECT * FROM comision
      WHERE codigo ILIKE '%A881%' OR codigo ILIKE '%A886%' 
         OR codigo ILIKE '%BREDP%' OR codigo ILIKE '%BAIC%'
    `);
    console.log(`Encontrados por codigo: ${busCod.rowCount}`);
    if (busCod.rowCount > 0) console.dir(busCod.rows, { depth: null });

    // 5. ¿Existe alguna FK entre venta y comision?
    console.log('\n=== FOREIGN KEYS de venta ===');
    const fks = await tango.query(`
      SELECT tc.constraint_name, kcu.column_name, 
             ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'venta' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    console.table(fks.rows);

    // 6. ¿La venta tiene algún campo que apunte a comision o tipoplan?
    console.log('\n=== CAMPOS de venta con "plan" o "comision" en nombre ===');
    const ventaCols = await tango.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'venta'
        AND (column_name ILIKE '%plan%' OR column_name ILIKE '%tipo%' OR column_name ILIKE '%comision%')
      ORDER BY ordinal_position
    `);
    console.table(ventaCols.rows);

    // 7. ¿Cómo se calcula comisionclaro en las ventas que SÍ tienen?
    console.log('\n=== VENTAS CON comisionclaro lleno vs codigovoz ===');
    const conCom = await tango.query(`
      SELECT v.ventaid, v.codigovoz, v.ventatipoid, v.comisionclaro,
             tp.rate as tipoplan_rate, tp.comisionclaro as tipoplan_comision,
             tp.codigovoz as tp_codigovoz
      FROM venta v
      LEFT JOIN tipoplan tp ON tp.codigovoz = v.codigovoz AND tp.rate::text = 
        CASE 
          WHEN v.codigovoz LIKE '%54.99%' THEN '54.99'
          WHEN v.codigovoz LIKE '%104.99%' THEN '104.99'
          WHEN v.codigovoz LIKE '%174.99%' THEN '174.99'
          ELSE tp.rate::text
        END
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
        AND v.comisionclaro > 0
      ORDER BY v.codigovoz
      LIMIT 15
    `);
    console.table(conCom.rows);

    // 8. Tabla comision - buscar por ventatipoid
    console.log('\n=== comision - buscar por ventatipoid (si existe campo) ===');
    const comVTI = await tango.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'comision' AND column_name ILIKE '%ventatipo%'
    `);
    if (comVTI.rowCount > 0) {
      console.log('Campo ventatipo encontrado en comision:', comVTI.rows);
    } else {
      console.log('No hay campo ventatipo en tabla comision');
      // buscar relación indirecta
      const comRelated = await tango.query(`
        SELECT * FROM comision WHERE comisionclaro > 0 LIMIT 10
      `);
      console.log('\nComision con comisionclaro > 0:');
      console.dir(comRelated.rows, { depth: null });
    }

    // 9. historial_comision - ¿tiene datos PYMES?
    console.log('\n=== historial_comision - registros recientes ===');
    const hist = await tango.query(`
      SELECT * FROM historial_comision
      ORDER BY id DESC LIMIT 10
    `);
    console.dir(hist.rows, { depth: null });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await tango.end();
  }
}

main();
