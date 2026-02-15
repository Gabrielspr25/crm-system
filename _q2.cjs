const { Pool } = require('pg');
const p = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
async function run() {
  // Ventas por tipo PYMES
  let r = await p.query(`
    SELECT vt.ventatipoid, vt.nombre, count(v.ventaid) as total
    FROM ventatipo vt
    LEFT JOIN venta v ON v.ventatipoid = vt.ventatipoid
    WHERE vt.ventatipoid IN (138,139,140,141)
    GROUP BY vt.ventatipoid, vt.nombre
    ORDER BY vt.ventatipoid
  `);
  console.log('=== VENTAS PYMES EN TANGO ===');
  let gran_total = 0;
  r.rows.forEach(row => {
    console.log(`  ${row.ventatipoid} ${row.nombre}: ${row.total} ventas`);
    gran_total += parseInt(row.total);
  });
  console.log(`  --------------------------`);
  console.log(`  TOTAL: ${gran_total} ventas`);

  // Clientes unicos
  r = await p.query(`
    SELECT count(DISTINCT v.crmclienteid) as clientes_unicos
    FROM venta v
    WHERE v.ventatipoid IN (138,139,140,141)
  `);
  console.log(`\n  Clientes únicos con ventas PYMES: ${r.rows[0].clientes_unicos}`);

  // BANs unicos
  r = await p.query(`
    SELECT count(DISTINCT v.ban) as bans_unicos
    FROM venta v
    WHERE v.ventatipoid IN (138,139,140,141)
  `).catch(() => null);
  if (r) console.log(`  BANs únicos: ${r.rows[0].bans_unicos}`);

  // Suscriptores (lineas) unicos
  r = await p.query(`
    SELECT count(DISTINCT vp.linea) as lineas
    FROM ventaproducto vp
    JOIN venta v ON v.ventaid = vp.ventaid
    WHERE v.ventatipoid IN (138,139,140,141)
  `).catch(() => null);
  if (r) console.log(`  Líneas/suscriptores únicos: ${r.rows[0].lineas}`);

  p.end();
}
run().catch(e => { console.log('ERR:', e.message); p.end(); });
