const { Pool } = require('pg');
const p = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
async function run() {
  // Columnas de venta
  let r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='venta' AND column_name LIKE '%client%' OR (table_name='venta' AND column_name LIKE '%ban%') OR (table_name='venta' AND column_name LIKE '%crm%') ORDER BY ordinal_position");
  console.log('Columnas cliente/ban en venta:', r.rows.map(x=>x.column_name).join(', '));

  // Sample venta PYMES
  r = await p.query("SELECT * FROM venta WHERE ventatipoid IN (138,139,140,141) LIMIT 2");
  console.log('\nSample ventas PYMES:');
  r.rows.forEach(row => console.log(JSON.stringify(row)));

  // Clientes y BANs unicos
  r = await p.query(`
    SELECT 
      count(DISTINCT clienteid) as clientes,
      count(DISTINCT ban) as bans,
      count(ventaid) as ventas
    FROM venta WHERE ventatipoid IN (138,139,140,141)
  `).catch(async () => {
    // Try other column names  
    const cols = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='venta' ORDER BY ordinal_position");
    console.log('ALL venta cols:', cols.rows.map(x=>x.column_name).join(', '));
    return null;
  });
  if (r) {
    console.log(`\nClientes únicos: ${r.rows[0].clientes}`);
    console.log(`BANs únicos: ${r.rows[0].bans}`);
    console.log(`Total ventas: ${r.rows[0].ventas}`);
  }

  p.end();
}
run().catch(e => { console.log('ERR:', e.message); p.end(); });
