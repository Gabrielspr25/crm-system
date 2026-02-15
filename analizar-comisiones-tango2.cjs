const { Pool } = require('pg');

const tango = new Pool({
  host: '167.99.12.125', port: 5432,
  database: 'claropr', user: 'postgres',
  password: 'fF00JIRFXc',
  connectionTimeoutMillis: 10000
});

async function main() {
  try {
    // 1. Tabla COMISION - estructura
    console.log('=== ESTRUCTURA TABLA comision ===');
    const comCols = await tango.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'comision'
      ORDER BY ordinal_position
    `);
    console.table(comCols.rows);

    // 2. Ejemplo de registros en comision
    console.log('\n=== DATOS comision (primeros 15) ===');
    const comData = await tango.query(`SELECT * FROM comision ORDER BY comisionid LIMIT 15`);
    console.dir(comData.rows, { depth: null });

    // 3. Tabla TIPOPLAN - tiene comisionclaro
    console.log('\n=== ESTRUCTURA TABLA tipoplan ===');
    const tpCols = await tango.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tipoplan'
      ORDER BY ordinal_position
    `);
    console.table(tpCols.rows);

    // 4. Datos tipoplan
    console.log('\n=== DATOS tipoplan (todos) ===');
    const tpData = await tango.query(`SELECT * FROM tipoplan ORDER BY tipoplanid`);
    console.dir(tpData.rows, { depth: null });

    // 5. Tabla historial_comision
    console.log('\n=== ESTRUCTURA historial_comision ===');
    const hcCols = await tango.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'historial_comision'
      ORDER BY ordinal_position
    `);
    console.table(hcCols.rows);

    // 6. Buscar en comision los codigos que coinciden con codigovoz de ventas PYMES
    console.log('\n=== COMISION para planes PYMES (A881, A886, BREDP1, etc) ===');
    const comPymes = await tango.query(`
      SELECT c.*, tp.nombre as tipoplan_nombre
      FROM comision c
      LEFT JOIN tipoplan tp ON tp.tipoplanid = c.tipoplanid
      WHERE c.nombre ILIKE '%A881%' 
         OR c.nombre ILIKE '%A886%' 
         OR c.nombre ILIKE '%BREDP%'
         OR c.nombre ILIKE '%BAIC%'
         OR c.nombre ILIKE '%A872%'
         OR c.nombre ILIKE '%A870%'
         OR c.codigo ILIKE '%A881%' 
         OR c.codigo ILIKE '%A886%' 
         OR c.codigo ILIKE '%BREDP%'
      ORDER BY c.nombre
    `);
    if (comPymes.rowCount > 0) {
      console.dir(comPymes.rows, { depth: null });
    } else {
      // Buscar más amplio
      console.log('No encontrado por nombre, buscando por tipoplan PYMES...');
      const comAll = await tango.query(`
        SELECT c.comisionid, c.nombre, c.codigo, c.comisionclaro, c.tipoplanid,
               tp.nombre as tipoplan_nombre
        FROM comision c
        LEFT JOIN tipoplan tp ON tp.tipoplanid = c.tipoplanid
        ORDER BY c.comisionid
        LIMIT 30
      `);
      console.table(comAll.rows);
    }

    // 7. Relación entre venta.codigovoz y tabla comision
    console.log('\n=== ¿Cómo se vincula codigovoz con comision? ===');
    const linkCheck = await tango.query(`
      SELECT DISTINCT v.codigovoz, c.comisionid, c.nombre as comision_nombre, c.comisionclaro as comision_monto
      FROM venta v
      LEFT JOIN comision c ON c.codigo = v.codigovoz
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY v.codigovoz
    `);
    console.table(linkCheck.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await tango.end();
  }
}

main();
