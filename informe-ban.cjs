const { Pool } = require('pg');

async function main() {
  const tango = new Pool({ host: '167.99.12.125', port: 5432, user: 'postgres', password: 'fF00JIRFXc', database: 'claropr' });
  const crm = new Pool({ host: '143.244.191.139', port: 5432, user: 'crm_user', password: 'CRM_Seguro_2025!', database: 'crm_pro' });

  const tipoNames = { '138': 'Update REN (138)', '139': 'Update NEW (139)', '140': 'Fijo REN (140)', '141': 'Fijo NEW (141)' };

  // Tango
  const tangoRes = await tango.query(`
    SELECT LEFT(v.fechaactivacion::text, 7) as mes, v.ventatipoid::text as tipo_id,
           COALESCE(cc.nombre, 'SIN NOMBRE') as cliente, v.ban, COUNT(*) as ventas
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    WHERE v.ventatipoid IN (138,139,140,141) AND v.activo = true
    GROUP BY mes, v.ventatipoid, cc.nombre, v.ban ORDER BY mes, cc.nombre, v.ban, v.ventatipoid
  `);

  // CRM
  const crmRes = await crm.query(`
    SELECT TO_CHAR(sr.report_month, 'YYYY-MM') as mes,
           COALESCE(b.account_type, 'N/A') as account_type, s.line_type,
           c.name as cliente, b.ban_number as ban, COUNT(*) as ventas
    FROM subscriber_reports sr
    JOIN subscribers s ON s.id = sr.subscriber_id
    JOIN bans b ON b.id = s.ban_id
    JOIN clients c ON c.id = b.client_id
    GROUP BY mes, b.account_type, s.line_type, c.name, b.ban_number
    ORDER BY mes, c.name, b.ban_number
  `);

  function crmTipo(at, lt) {
    const a = (at||'').toUpperCase(), l = (lt||'').toUpperCase();
    if (a.includes('UPDATE') && l === 'REN') return 'Update REN (138)';
    if (a.includes('UPDATE') && l === 'NEW') return 'Update NEW (139)';
    if (a.includes('FIJO') && l === 'REN') return 'Fijo REN (140)';
    if (a.includes('FIJO') && l === 'NEW') return 'Fijo NEW (141)';
    return `${at} ${lt}`;
  }

  // Build: key = mes|tipo|cliente|ban
  const tangoMap = {}, crmMap = {};
  for (const r of tangoRes.rows) {
    const k = `${r.mes}|${tipoNames[r.tipo_id]}|${r.cliente}|${(r.ban||'').trim()}`;
    tangoMap[k] = (tangoMap[k]||0) + parseInt(r.ventas);
  }
  for (const r of crmRes.rows) {
    const k = `${r.mes}|${crmTipo(r.account_type,r.line_type)}|${r.cliente}|${(r.ban||'').trim()}`;
    crmMap[k] = (crmMap[k]||0) + parseInt(r.ventas);
  }

  const allKeys = [...new Set([...Object.keys(tangoMap), ...Object.keys(crmMap)])].sort();

  // Group by mes
  const byMes = {};
  for (const k of allKeys) {
    const [mes] = k.split('|');
    if (!byMes[mes]) byMes[mes] = [];
    byMes[mes].push(k);
  }

  // Output as markdown-friendly
  console.log('| MES | Tipo | Cliente | BAN | TANGO | CRM | Diff |');
  console.log('|-----|------|---------|-----|:---:|:---:|:---:|');

  for (const mes of Object.keys(byMes).sort()) {
    let tTotal = 0, cTotal = 0, first = true;
    for (const k of byMes[mes]) {
      const [,tipo, cliente, ban] = k.split('|');
      const t = tangoMap[k] || 0;
      const c = crmMap[k] || 0;
      tTotal += t; cTotal += c;
      const diff = t - c;
      const diffStr = diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : `${diff}`);
      const mesCol = first ? `**${mes}**` : '';
      first = false;
      console.log(`| ${mesCol} | ${tipo} | ${cliente} | ${ban} | ${t} | ${c} | ${diffStr} |`);
    }
    const td = tTotal - cTotal;
    const tds = td === 0 ? '✓' : (td > 0 ? `+${td}` : `${td}`);
    console.log(`| | **TOTAL** | | | **${tTotal}** | **${cTotal}** | **${tds}** |`);
  }

  let gt = 0, gc = 0;
  for (const k of allKeys) { gt += tangoMap[k]||0; gc += crmMap[k]||0; }
  const gd = gt - gc;
  console.log(`| **GRAN TOTAL** | | | | **${gt}** | **${gc}** | **${gd === 0 ? '✓' : (gd>0?`+${gd}`:`${gd}`)}** |`);

  await tango.end(); await crm.end();
}
main().catch(e => { console.error(e); process.exit(1); });
