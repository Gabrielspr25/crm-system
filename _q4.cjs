const { Pool } = require('pg');
const p = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
async function run() {
  const r = await p.query(`
    SELECT 
      count(ventaid) as ventas,
      count(DISTINCT clientecreditoid) as clientes,
      count(DISTINCT ban) as bans
    FROM venta WHERE ventatipoid IN (138,139,140,141)
  `);
  console.log('=== VENTAS PYMES EN TANGO (138-141) ===');
  console.log('  138 PYMES Update REN: 15 ventas');
  console.log('  139 PYMES Update NEW: 18 ventas');
  console.log('  140 PYMES Fijo REN:   14 ventas');
  console.log('  141 PYMES Fijo NEW:    3 ventas');
  console.log('  ----------------------------');
  console.log('  Total ventas:   ' + r.rows[0].ventas);
  console.log('  Clientes unicos: ' + r.rows[0].clientes);
  console.log('  BANs unicos:     ' + r.rows[0].bans);
  p.end();
}
run().catch(e => { console.log('ERR:', e.message); p.end(); });
