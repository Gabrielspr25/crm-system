const { Pool } = require('pg');
const p = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
async function run() {
  // schema ventatipo
  let r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='ventatipo' ORDER BY ordinal_position");
  console.log('COLS ventatipo:', r.rows.map(x=>x.column_name).join(', '));
  // schema venta
  r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='venta' ORDER BY ordinal_position");
  console.log('COLS venta:', r.rows.map(x=>x.column_name).join(', '));
  // sample ventatipo PYMES
  r = await p.query("SELECT * FROM ventatipo WHERE ventatipoid IN (138,139,140,141) ORDER BY ventatipoid");
  if (r.rows.length === 0) {
    // try without specific column
    r = await p.query("SELECT * FROM ventatipo LIMIT 5");
    console.log('SAMPLE ventatipo:', JSON.stringify(r.rows, null, 2));
  } else {
    console.log('PYMES ventatipo:', JSON.stringify(r.rows, null, 2));
  }
  p.end();
}
run().catch(e => { console.log('ERR:', e.message); p.end(); });
