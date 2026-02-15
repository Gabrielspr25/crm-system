const { Pool } = require('pg');

const tango = new Pool({host:'167.99.12.125',port:5432,database:'claropr',user:'postgres',password:'fF00JIRFXc'});
const crm = new Pool({host:'143.244.191.139',port:5432,database:'crm_pro',user:'crm_user',password:'CRM_Seguro_2025!'});

async function run() {
  // 1. Schema subscriber_reports
  let r = await crm.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='subscriber_reports' ORDER BY ordinal_position");
  console.log('=== SCHEMA subscriber_reports ===');
  r.rows.forEach(x => console.log(`  ${x.column_name} (${x.data_type})`));

  // 2. Current data in subscriber_reports
  r = await crm.query("SELECT count(*) as total FROM subscriber_reports");
  console.log('\nTotal registros en subscriber_reports:', r.rows[0].total);

  // 3. Sample
  r = await crm.query("SELECT * FROM subscriber_reports LIMIT 3");
  console.log('\nSample subscriber_reports:');
  r.rows.forEach(x => console.log(JSON.stringify(x)));

  // 4. Check which PYMES BANs are already in subscriber_reports
  const pymesBans = ['762928710','719400825','660829370','849389700','774826223',
    '718513352','784175066','849215381','840446053','796167936','827192558',
    '793287413','848913680','841786385','800243429','819394566','819713369'];
  
  r = await crm.query(`
    SELECT sr.ban_number, c.name as client_name, count(*) as reports
    FROM subscriber_reports sr
    LEFT JOIN clients c ON c.id = sr.client_id
    WHERE sr.ban_number = ANY($1)
    GROUP BY sr.ban_number, c.name
    ORDER BY c.name
  `, [pymesBans]);
  console.log('\n=== PYMES YA EN SUBSCRIBER_REPORTS ===');
  if (r.rows.length === 0) console.log('  NINGUNO');
  r.rows.forEach(x => console.log(`  ${x.ban_number} | ${x.client_name} | ${x.reports} reports`));

  // 5. Check follow_up_prospects completados
  r = await crm.query("SELECT count(*) as total FROM follow_up_prospects WHERE completed_date IS NOT NULL");
  console.log('\n=== FOLLOW_UP COMPLETADOS ===');
  console.log('Total completados:', r.rows[0].total);
  
  r = await crm.query(`
    SELECT fp.id, fp.company_name, fp.completed_date, c.name as client_name
    FROM follow_up_prospects fp
    LEFT JOIN clients c ON c.id = fp.client_id
    WHERE fp.completed_date IS NOT NULL
    ORDER BY fp.completed_date DESC
  `);
  r.rows.forEach(x => console.log(`  ${x.company_name || x.client_name} - completado: ${x.completed_date}`));

  // 6. All Tango PYMES ventas detail for import
  r = await tango.query(`
    SELECT 
      v.ventaid, v.ventatipoid, vt.nombre as tipo,
      cc.nombre as cliente, cc.ban as cliente_ban,
      v.ban as venta_ban, v.fechaactivacion,
      vd.nombre as vendedor, v.vendedorid,
      v.codigovoz as plan, v.comisionclaro,
      v.status as linea, v.meses
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
    WHERE v.ventatipoid IN (138,139,140,141)
    ORDER BY v.fechaactivacion DESC
  `);
  console.log('\n=== VENTAS PYMES PARA IMPORTAR ===');
  console.log(`Total: ${r.rows.length} ventas`);
  r.rows.forEach(x => {
    console.log(`  ${x.ventaid} | ${x.tipo} | ${(x.cliente||'').substring(0,30)} | BAN:${x.venta_ban} | ${x.vendedor} | ${x.fechaactivacion ? new Date(x.fechaactivacion).toISOString().split('T')[0] : 'N/A'} | Plan:${x.plan} | Linea:${(x.linea||'').trim()} | Comision:${x.comisionclaro}`);
  });

  // 7. Map vendedores tango -> CRM salespeople
  const vendedores = await crm.query("SELECT id, name FROM salespeople");
  console.log('\n=== VENDEDORES CRM ===');
  vendedores.rows.forEach(x => console.log(`  ${x.id} | ${x.name}`));

  tango.end();
  crm.end();
}
run().catch(e => { console.log('ERR:', e.message); tango.end(); crm.end(); });
