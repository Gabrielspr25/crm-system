const { Pool } = require('pg');

const tango = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
const crm = new Pool({host:'143.244.191.139',port:5432,database:'crm_pro',user:'crm_user',password:'CRM_Seguro_2025!'});

async function run() {
  // Get all unique BANs from PYMES sales in Tango
  const tangoBans = await tango.query(`
    SELECT DISTINCT v.ban, cc.nombre as cliente, vd.nombre as vendedor
    FROM venta v
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
    WHERE v.ventatipoid IN (138,139,140,141)
    ORDER BY cc.nombre
  `);

  console.log('=== PYMES TANGO vs CRM ===\n');
  console.log('BAN | Cliente Tango | Vendedor | En CRM? | Cliente CRM');
  console.log('-'.repeat(120));

  let encontrados = 0;
  let noEncontrados = 0;

  for (const row of tangoBans.rows) {
    const ban = row.ban;
    // Search in CRM by ban_number
    const crmResult = await crm.query(
      `SELECT b.ban_number, c.name as client_name, s.name as vendedor
       FROM bans b
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN salespeople s ON s.id = c.salesperson_id
       WHERE b.ban_number = $1`,
      [ban]
    );

    if (crmResult.rows.length > 0) {
      encontrados++;
      const c = crmResult.rows[0];
      console.log(`${ban} | ${(row.cliente||'').padEnd(35)} | ${(row.vendedor||'').padEnd(18)} | SI | ${c.client_name} (${c.vendedor||'sin vendedor'})`);
    } else {
      noEncontrados++;
      console.log(`${ban} | ${(row.cliente||'').padEnd(35)} | ${(row.vendedor||'').padEnd(18)} | NO |`);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Total BANs PYMES en Tango: ${tangoBans.rows.length}`);
  console.log(`Encontrados en CRM:        ${encontrados}`);
  console.log(`NO encontrados en CRM:     ${noEncontrados}`);

  tango.end();
  crm.end();
}
run().catch(e => { console.log('ERR:', e.message); tango.end(); crm.end(); });
