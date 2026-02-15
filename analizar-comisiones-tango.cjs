const { Pool } = require('pg');

const tango = new Pool({
  host: '167.99.12.125', port: 5432,
  database: 'claropr', user: 'postgres',
  password: 'fF00JIRFXc',
  connectionTimeoutMillis: 10000
});

async function main() {
  try {
    // 1. Cuántas ventas PYMES tienen comisiones vs NULL
    console.log('=== COMISIONES EN VENTAS PYMES (138-141) ===');
    const stats = await tango.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(comisionclaro) as con_comision_claro,
        COUNT(CASE WHEN comisionclaro > 0 THEN 1 END) as comision_claro_mayor_0,
        COUNT(comisionvendedor) as con_comision_vendedor,
        COUNT(CASE WHEN comisionvendedor > 0 THEN 1 END) as comision_vendedor_mayor_0,
        SUM(COALESCE(comisionclaro, 0)) as total_com_claro,
        SUM(COALESCE(comisionvendedor, 0)) as total_com_vendedor
      FROM venta
      WHERE ventatipoid IN (138, 139, 140, 141)
        AND activo = true
    `);
    console.table(stats.rows);

    // 2. Muestra ejemplo de ventas CON comision (si hay)
    console.log('\n=== VENTAS CON comisionclaro > 0 ===');
    const conCom = await tango.query(`
      SELECT ventaid, ban, status as linea, comisionclaro, comisionvendedor, 
             codigovoz, codigodata, ventatipoid
      FROM venta
      WHERE ventatipoid IN (138, 139, 140, 141)
        AND activo = true
        AND comisionclaro > 0
      LIMIT 10
    `);
    console.table(conCom.rows);
    console.log(`Total con comisionclaro > 0: ${conCom.rowCount}`);

    // 3. Muestra ejemplo de ventas SIN comision
    console.log('\n=== VENTAS SIN comisionclaro (NULL o 0) ===');
    const sinCom = await tango.query(`
      SELECT ventaid, ban, status as linea, comisionclaro, comisionvendedor, 
             codigovoz, codigodata, ventatipoid
      FROM venta
      WHERE ventatipoid IN (138, 139, 140, 141)
        AND activo = true
        AND (comisionclaro IS NULL OR comisionclaro = 0)
      LIMIT 10
    `);
    console.table(sinCom.rows);
    console.log(`Total sin comisionclaro: ${sinCom.rowCount}`);

    // 4. Buscar tablas de planes/tarifas que tengan comisiones
    console.log('\n=== TABLAS RELACIONADAS CON COMISIONES/PLANES ===');
    const tables = await tango.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND (table_name ILIKE '%plan%' 
             OR table_name ILIKE '%comision%' 
             OR table_name ILIKE '%tarif%'
             OR table_name ILIKE '%precio%'
             OR table_name ILIKE '%codigo%')
      ORDER BY table_name
    `);
    console.table(tables.rows);

    // 5. Buscar tabla codigovoz - puede tener la comisión por plan
    console.log('\n=== ESTRUCTURA TABLA codigovoz (si existe) ===');
    const codVozCols = await tango.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'codigovoz'
      ORDER BY ordinal_position
    `);
    if (codVozCols.rowCount > 0) {
      console.table(codVozCols.rows);
      
      // Ver un registro de ejemplo
      const ejemplo = await tango.query(`SELECT * FROM codigovoz LIMIT 3`);
      console.log('\nEjemplo codigovoz:');
      console.dir(ejemplo.rows, { depth: null });
    } else {
      console.log('Tabla codigovoz NO existe');
    }

    // 6. Buscar tabla codigodata
    console.log('\n=== ESTRUCTURA TABLA codigodata (si existe) ===');
    const codDataCols = await tango.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'codigodata'
      ORDER BY ordinal_position
    `);
    if (codDataCols.rowCount > 0) {
      console.table(codDataCols.rows);
    } else {
      console.log('Tabla codigodata NO existe');
    }

    // 7. Buscar TODAS las tablas con columna "comision" en su nombre
    console.log('\n=== COLUMNAS CON "comision" EN CUALQUIER TABLA ===');
    const comCols = await tango.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE column_name ILIKE '%comision%'
      ORDER BY table_name, column_name
    `);
    console.table(comCols.rows);

    // 8. Desglose por codigovoz de cuántas tienen comisión
    console.log('\n=== DESGLOSE POR PLAN (codigovoz) ===');
    const porPlan = await tango.query(`
      SELECT codigovoz, ventatipoid,
             COUNT(*) as total,
             COUNT(CASE WHEN comisionclaro > 0 THEN 1 END) as con_comision,
             AVG(NULLIF(comisionclaro, 0))::numeric(10,2) as avg_comision_claro,
             AVG(NULLIF(comisionvendedor, 0))::numeric(10,2) as avg_comision_vendedor
      FROM venta
      WHERE ventatipoid IN (138, 139, 140, 141)
        AND activo = true
      GROUP BY codigovoz, ventatipoid
      ORDER BY codigovoz, ventatipoid
    `);
    console.table(porPlan.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await tango.end();
  }
}

main();
