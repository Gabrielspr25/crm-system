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

  // --- TANGO: ventas por mes y tipo ---
  const tangoRes = await tango.query(`
    SELECT LEFT(v.fechaactivacion::text, 7) as mes,
           v.ventatipoid as tipo_id,
           vt.nombre as tipo,
           COUNT(*) as ventas
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    WHERE v.ventatipoid IN (138,139,140,141) AND v.activo = true
    GROUP BY mes, v.ventatipoid, vt.nombre
    ORDER BY mes, v.ventatipoid
  `);

  // --- CRM: ventas por mes y tipo (account_type + line_type) ---
  const crmRes = await crm.query(`
    SELECT TO_CHAR(sr.report_month, 'YYYY-MM') as mes,
           COALESCE(b.account_type, 'N/A') as account_type,
           s.line_type,
           COUNT(*) as ventas
    FROM subscriber_reports sr
    JOIN subscribers s ON s.id = sr.subscriber_id
    JOIN bans b ON b.id = s.ban_id
    GROUP BY mes, b.account_type, s.line_type
    ORDER BY mes, b.account_type, s.line_type
  `);

  // Map CRM types to Tango equivalents
  function crmToTangoType(acctType, lineType) {
    const at = (acctType || '').toLowerCase();
    const lt = (lineType || '').toUpperCase();
    if (at.includes('update') && lt === 'REN') return '138';
    if (at.includes('update') && lt === 'NEW') return '139';
    if (at.includes('fijo') && lt === 'REN') return '140';
    if (at.includes('fijo') && lt === 'NEW') return '141';
    return 'unknown';
  }

  const tipoNames = {
    '138': 'PYMES Update REN',
    '139': 'PYMES Update NEW',
    '140': 'PYMES Fijo REN',
    '141': 'PYMES Fijo NEW',
    'unknown': 'SIN TIPO'
  };

  // Build maps: { mes: { tipo_id: ventas } }
  const tangoMap = {};
  for (const r of tangoRes.rows) {
    if (!tangoMap[r.mes]) tangoMap[r.mes] = {};
    tangoMap[r.mes][r.tipo_id] = parseInt(r.ventas);
  }

  const crmMap = {};
  for (const r of crmRes.rows) {
    const tipoId = crmToTangoType(r.account_type, r.line_type);
    if (!crmMap[r.mes]) crmMap[r.mes] = {};
    crmMap[r.mes][tipoId] = (crmMap[r.mes][tipoId] || 0) + parseInt(r.ventas);
  }

  const allMonths = [...new Set([...Object.keys(tangoMap), ...Object.keys(crmMap)])].sort();
  const tipos = ['138', '139', '140', '141'];

  // Print report
  const sep = '─';
  console.log('\n╔══════════╦══════════════════════╦═════════╦═════════╦═════════╗');
  console.log('║   MES    ║     TIPO VENTA       ║  TANGO  ║   CRM   ║  DIFF   ║');
  console.log('╠══════════╬══════════════════════╬═════════╬═════════╬═════════╣');

  for (const mes of allMonths) {
    let mesFirst = true;
    let tangoTotal = 0, crmTotal = 0;

    for (const tipo of tipos) {
      const t = (tangoMap[mes] || {})[tipo] || 0;
      const c = (crmMap[mes] || {})[tipo] || 0;
      tangoTotal += t;
      crmTotal += c;
      const diff = t - c;
      const diffStr = diff === 0 ? '  ✓' : (diff > 0 ? ` +${diff}` : ` ${diff}`);
      const mesCol = mesFirst ? mes : '';
      mesFirst = false;
      console.log(`║ ${mesCol.padEnd(8)} ║ ${tipoNames[tipo].padEnd(20)} ║ ${String(t).padStart(7)} ║ ${String(c).padStart(7)} ║ ${diffStr.padStart(7)} ║`);
    }

    // Check unknown CRM types
    const unknownCrm = (crmMap[mes] || {})['unknown'] || 0;
    if (unknownCrm > 0) {
      crmTotal += unknownCrm;
      console.log(`║          ║ ${'SIN TIPO'.padEnd(20)} ║ ${String(0).padStart(7)} ║ ${String(unknownCrm).padStart(7)} ║ ${String(-unknownCrm).padStart(7)} ║`);
    }

    const totalDiff = tangoTotal - crmTotal;
    const totalDiffStr = totalDiff === 0 ? '  ✓' : (totalDiff > 0 ? ` +${totalDiff}` : ` ${totalDiff}`);
    console.log(`║          ║ ${'TOTAL MES'.padEnd(20)} ║ ${String(tangoTotal).padStart(7)} ║ ${String(crmTotal).padStart(7)} ║ ${totalDiffStr.padStart(7)} ║`);
    console.log('╠══════════╬══════════════════════╬═════════╬═════════╬═════════╣');
  }

  // Grand totals
  let gt = 0, gc = 0;
  for (const mes of allMonths) {
    for (const tipo of tipos) {
      gt += (tangoMap[mes] || {})[tipo] || 0;
      gc += (crmMap[mes] || {})[tipo] || 0;
    }
    gc += (crmMap[mes] || {})['unknown'] || 0;
  }
  const gdiff = gt - gc;
  const gdiffStr = gdiff === 0 ? '  ✓' : (gdiff > 0 ? ` +${gdiff}` : ` ${gdiff}`);
  console.log(`║ TOTAL    ║ ${'TODAS LAS VENTAS'.padEnd(20)} ║ ${String(gt).padStart(7)} ║ ${String(gc).padStart(7)} ║ ${gdiffStr.padStart(7)} ║`);
  console.log('╚══════════╩══════════════════════╩═════════╩═════════╩═════════╝');

  // Also show CRM account_type distribution
  const crmTypes = await crm.query(`
    SELECT COALESCE(b.account_type, 'NULL') as account_type,
           s.line_type,
           COUNT(*) as total
    FROM subscriber_reports sr
    JOIN subscribers s ON s.id = sr.subscriber_id
    JOIN bans b ON b.id = s.ban_id
    GROUP BY b.account_type, s.line_type
    ORDER BY b.account_type, s.line_type
  `);
  console.log('\n=== CRM: Distribución account_type + line_type ===');
  console.table(crmTypes.rows);

  await tango.end();
  await crm.end();
}
main().catch(e => { console.error(e); process.exit(1); });
