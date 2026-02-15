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

  // Tango: ventas por BAN en Feb 2026
  const tangoVentas = await tango.query(`
    SELECT v.ban, COUNT(*) as ventas, 
           STRING_AGG(COALESCE(v.status,'?'), ', ' ORDER BY v.ventaid) as lineas,
           COALESCE(cc.nombre, 'SIN NOMBRE') as cliente
    FROM venta v
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    WHERE v.ventatipoid IN (138,139,140,141) AND v.activo = true
      AND v.fechaactivacion >= '2026-02-01' AND v.fechaactivacion < '2026-03-01'
    GROUP BY v.ban, cc.nombre
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  console.log('\n=== TANGO: BANs con múltiples ventas en Feb 2026 ===');
  for (const r of tangoVentas.rows) {
    console.log(`  BAN ${r.ban} → ${r.ventas} ventas (${r.cliente}) → Líneas: ${r.lineas}`);
  }

  const allTangoBans = await tango.query(`
    SELECT v.ban, COUNT(*) as ventas, COALESCE(cc.nombre, 'SIN NOMBRE') as cliente
    FROM venta v
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    WHERE v.ventatipoid IN (138,139,140,141) AND v.activo = true
      AND v.fechaactivacion >= '2026-02-01' AND v.fechaactivacion < '2026-03-01'
    GROUP BY v.ban, cc.nombre ORDER BY v.ban
  `);

  const banNumbers = allTangoBans.rows.map(r => (r.ban || '').trim());
  
  const crmData = await crm.query(`
    SELECT b.ban_number, COUNT(distinct s.id) as subs, COUNT(distinct sr.subscriber_id) as reports_feb
    FROM bans b
    LEFT JOIN subscribers s ON s.ban_id = b.id
    LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id AND sr.report_month = '2026-02-01'
    WHERE b.ban_number = ANY($1)
    GROUP BY b.ban_number
  `, [banNumbers]);

  const crmMap = {};
  for (const r of crmData.rows) { crmMap[r.ban_number] = r; }

  console.log('\n=== COMPARACIÓN BAN POR BAN: Feb 2026 ===');
  console.log('BAN'.padEnd(18), 'CLIENTE'.padEnd(35), 'TANGO'.padStart(6), 'CRM_SUBS'.padStart(10), 'CRM_RPT'.padStart(9), 'DIFF'.padStart(6));
  console.log('-'.repeat(90));
  
  let totalTango = 0, totalCrm = 0, totalMissing = 0;
  for (const t of allTangoBans.rows) {
    const ban = (t.ban || '').trim();
    const c = crmMap[ban];
    const crmRpts = c ? parseInt(c.reports_feb) : 0;
    const crmSubs2 = c ? parseInt(c.subs) : 0;
    const diff = parseInt(t.ventas) - crmRpts;
    totalTango += parseInt(t.ventas);
    totalCrm += crmRpts;
    if (diff !== 0) totalMissing += diff;
    const marker = diff > 0 ? ' ⚠' : '';
    console.log(ban.padEnd(18), t.cliente.substring(0,34).padEnd(35), String(t.ventas).padStart(6), String(crmSubs2).padStart(10), String(crmRpts).padStart(9), String(diff > 0 ? `+${diff}` : diff).padStart(6) + marker);
  }
  console.log('-'.repeat(90));
  console.log('TOTAL'.padEnd(53), String(totalTango).padStart(6), ''.padStart(10), String(totalCrm).padStart(9), String(totalMissing > 0 ? `+${totalMissing}` : totalMissing).padStart(6));

  await tango.end();
  await crm.end();
}
main().catch(e => { console.error(e); process.exit(1); });
