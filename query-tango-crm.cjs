const { Pool } = require('pg');

async function main() {
  const tango = new Pool({
    host: '167.99.12.125', port: 5432, user: 'postgres',
    password: 'fF00JIRFXc', database: 'claropr'
  });
  const crm = new Pool({
    host: '143.244.191.139', port: 5432, user: 'crm_user',
    password: 'CRM_Seguro_2025!', database: 'crm_pro'
  });

  const tangoRes = await tango.query(`
    SELECT LEFT(v.fechaactivacion::text, 7) as mes, COUNT(*) as ventas
    FROM venta v
    WHERE v.ventatipoid IN (138,139,140,141) AND v.activo = true
    GROUP BY mes ORDER BY mes
  `);

  const crmRes = await crm.query(`
    SELECT TO_CHAR(report_month, 'YYYY-MM') as mes, COUNT(*) as ventas
    FROM subscriber_reports
    GROUP BY report_month ORDER BY report_month
  `);

  const tangoMap = {};
  tangoRes.rows.forEach(r => { tangoMap[r.mes] = parseInt(r.ventas); });
  const crmMap = {};
  crmRes.rows.forEach(r => { crmMap[r.mes] = parseInt(r.ventas); });

  const allMonths = [...new Set([...Object.keys(tangoMap), ...Object.keys(crmMap)])].sort();

  console.log('\n┌────────────┬───────────────┬───────────────┬──────────┐');
  console.log('│    MES     │ TANGO (PYMES) │  CRM (PYMES)  │  MATCH   │');
  console.log('├────────────┼───────────────┼───────────────┼──────────┤');
  for (const mes of allMonths) {
    const t = tangoMap[mes] || 0;
    const c = crmMap[mes] || 0;
    const match = t === c ? '  ✓' : `  ✗ (${t-c > 0 ? '+' : ''}${t-c})`;
    console.log(`│ ${mes.padEnd(10)} │ ${String(t).padStart(13)} │ ${String(c).padStart(13)} │${match.padEnd(9)} │`);
  }
  console.log('└────────────┴───────────────┴───────────────┴──────────┘');

  await tango.end();
  await crm.end();
}
main().catch(e => { console.error(e); process.exit(1); });
