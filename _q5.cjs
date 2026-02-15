const { Pool } = require('pg');
const p = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
async function run() {
  const r = await p.query(`
    SELECT 
      v.ventaid,
      v.ventatipoid,
      vt.nombre as tipo_venta,
      cc.nombre as cliente,
      cc.ban as cliente_ban,
      v.ban as venta_ban,
      vd.nombre as vendedor,
      v.fechaactivacion,
      v.codigovoz as plan,
      v.comisionclaro,
      v.comisionvendedor,
      v.bonoportabilidad,
      v.bonoretencion,
      v.bonovolumen,
      v.comisionextra,
      v.comisionpapper,
      v.status as linea
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
    WHERE v.ventatipoid IN (138,139,140,141)
    ORDER BY v.fechaactivacion DESC
  `);
  
  console.log('=== LISTADO DE VENTAS PYMES (138-141) ===\n');
  console.log('ID | Tipo | Cliente | BAN | Vendedor | Fecha | Plan | Línea | Com.Claro | Com.Vendedor');
  console.log('-'.repeat(140));
  
  r.rows.forEach(row => {
    const fecha = row.fechaactivacion ? new Date(row.fechaactivacion).toLocaleDateString('es-ES') : 'N/A';
    console.log(
      `${row.ventaid} | ${row.tipo_venta} | ${(row.cliente||'').substring(0,30)} | ${row.venta_ban||''} | ${(row.vendedor||'').substring(0,15)} | ${fecha} | ${(row.plan||'').substring(0,20)} | ${(row.linea||'').trim()} | ${row.comisionclaro||0} | ${row.comisionvendedor||0}`
    );
  });

  console.log('\nTotal: ' + r.rows.length + ' ventas');
  p.end();
}
run().catch(e => { console.log('ERR:', e.message); p.end(); });
