const { Pool } = require('pg');

async function main() {
  const tango = new Pool({
    host: '167.99.12.125', port: 5432, user: 'postgres',
    password: 'fF00JIRFXc', database: 'claropr'
  });

  // All PYMES types
  const types = await tango.query(`
    SELECT vt.ventatipoid, vt.nombre, COUNT(v.ventaid) as ventas
    FROM ventatipo vt
    LEFT JOIN venta v ON v.ventatipoid = vt.ventatipoid AND v.activo = true
    WHERE LOWER(vt.nombre) LIKE '%pymes%'
    GROUP BY vt.ventatipoid, vt.nombre
    ORDER BY vt.ventatipoid
  `);
  console.log('\n=== TODOS LOS TIPOS PYMES EN TANGO ===');
  console.table(types.rows);

  // Feb 2026 breakdown by type
  const feb = await tango.query(`
    SELECT v.ventatipoid, vt.nombre, COUNT(*) as ventas
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    WHERE v.activo = true
      AND v.fechaactivacion >= '2026-02-01' AND v.fechaactivacion < '2026-03-01'
      AND v.ventatipoid IN (138,139,140,141)
    GROUP BY v.ventatipoid, vt.nombre
    ORDER BY v.ventatipoid
  `);
  console.log('\n=== FEB 2026 POR TIPO ===');
  console.table(feb.rows);

  await tango.end();
}
main().catch(e => { console.error(e); process.exit(1); });
