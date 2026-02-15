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

  // Tango: ventas por mes, tipo, cliente
  const tangoRes = await tango.query(`
    SELECT LEFT(v.fechaactivacion::text, 7) as mes,
           v.ventatipoid as tipo_id,
           vt.nombre as tipo,
           COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
           v.ban,
           COUNT(*) as ventas
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    WHERE v.ventatipoid IN (138,139,140,141) AND v.activo = true
    GROUP BY mes, v.ventatipoid, vt.nombre, cc.nombre, v.ban
    ORDER BY mes, cc.nombre, v.ventatipoid
  `);

  // CRM: ventas por mes, tipo, cliente
  const crmRes = await crm.query(`
    SELECT TO_CHAR(sr.report_month, 'YYYY-MM') as mes,
           COALESCE(b.account_type, 'N/A') as account_type,
           s.line_type,
           c.name as cliente,
           b.ban_number as ban,
           COUNT(*) as ventas
    FROM subscriber_reports sr
    JOIN subscribers s ON s.id = sr.subscriber_id
    JOIN bans b ON b.id = s.ban_id
    JOIN clients c ON c.id = b.client_id
    GROUP BY mes, b.account_type, s.line_type, c.name, b.ban_number
    ORDER BY mes, c.name, b.account_type
  `);

  const tipoNames = { '138': 'Update REN', '139': 'Update NEW', '140': 'Fijo REN', '141': 'Fijo NEW' };

  // Build Tango map: mes -> cliente -> { ban, tipos }
  const tangoData = {};
  for (const r of tangoRes.rows) {
    const key = `${r.mes}|${r.cliente}`;
    if (!tangoData[key]) tangoData[key] = { mes: r.mes, cliente: r.cliente, ventas: 0, tipos: {} };
    tangoData[key].ventas += parseInt(r.ventas);
    const tName = tipoNames[r.tipo_id] || r.tipo;
    tangoData[key].tipos[tName] = (tangoData[key].tipos[tName] || 0) + parseInt(r.ventas);
  }

  // Build CRM map
  function crmTipoName(acctType, lineType) {
    const at = (acctType || '').toUpperCase();
    const lt = (lineType || '').toUpperCase();
    if (at.includes('UPDATE') && lt === 'REN') return 'Update REN';
    if (at.includes('UPDATE') && lt === 'NEW') return 'Update NEW';
    if (at.includes('FIJO') && lt === 'REN') return 'Fijo REN';
    if (at.includes('FIJO') && lt === 'NEW') return 'Fijo NEW';
    return `${acctType} ${lineType}`;
  }

  const crmData = {};
  for (const r of crmRes.rows) {
    const key = `${r.mes}|${r.cliente}`;
    if (!crmData[key]) crmData[key] = { mes: r.mes, cliente: r.cliente, ventas: 0, tipos: {} };
    crmData[key].ventas += parseInt(r.ventas);
    const tName = crmTipoName(r.account_type, r.line_type);
    crmData[key].tipos[tName] = (crmData[key].tipos[tName] || 0) + parseInt(r.ventas);
  }

  // Merge all keys
  const allKeys = [...new Set([...Object.keys(tangoData), ...Object.keys(crmData)])].sort();

  // Group by month
  const months = {};
  for (const key of allKeys) {
    const t = tangoData[key];
    const c = crmData[key];
    const mes = (t || c).mes;
    if (!months[mes]) months[mes] = [];
    months[mes].push({ key, tango: t, crm: c });
  }

  // Print
  const w = { mes: 8, cli: 38, tipo: 22, tv: 7, cv: 7, diff: 6 };
  const line = '═'.repeat(w.mes + w.cli + w.tipo + w.tv + w.cv + w.diff + 13);

  for (const mes of Object.keys(months).sort()) {
    console.log(`\n╔${'═'.repeat(w.mes+2)}╦${'═'.repeat(w.cli+2)}╦${'═'.repeat(w.tipo+2)}╦${'═'.repeat(w.tv+2)}╦${'═'.repeat(w.cv+2)}╦${'═'.repeat(w.diff+2)}╗`);
    console.log(`║ ${'MES'.padEnd(w.mes)} ║ ${'CLIENTE'.padEnd(w.cli)} ║ ${'TIPO'.padEnd(w.tipo)} ║ ${'TANGO'.padStart(w.tv)} ║ ${'CRM'.padStart(w.cv)} ║ ${'DIFF'.padStart(w.diff)} ║`);
    console.log(`╠${'═'.repeat(w.mes+2)}╬${'═'.repeat(w.cli+2)}╬${'═'.repeat(w.tipo+2)}╬${'═'.repeat(w.tv+2)}╬${'═'.repeat(w.cv+2)}╬${'═'.repeat(w.diff+2)}╣`);

    let mesTotal_t = 0, mesTotal_c = 0;
    let first = true;

    for (const entry of months[mes]) {
      const t = entry.tango;
      const c = entry.crm;
      const cliente = (t || c).cliente;
      const tv = t ? t.ventas : 0;
      const cv = c ? c.ventas : 0;
      mesTotal_t += tv;
      mesTotal_c += cv;

      // Collect all tipo names
      const allTipos = [...new Set([
        ...Object.keys(t ? t.tipos : {}),
        ...Object.keys(c ? c.tipos : {})
      ])].sort();

      let cliFirst = true;
      for (const tipo of allTipos) {
        const ttv = (t && t.tipos[tipo]) || 0;
        const ccv = (c && c.tipos[tipo]) || 0;
        const diff = ttv - ccv;
        const diffStr = diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : `${diff}`);
        const mesCol = first ? mes : '';
        const cliCol = cliFirst ? cliente.substring(0, w.cli) : '';
        first = false;
        cliFirst = false;
        console.log(`║ ${mesCol.padEnd(w.mes)} ║ ${cliCol.padEnd(w.cli)} ║ ${tipo.padEnd(w.tipo)} ║ ${String(ttv).padStart(w.tv)} ║ ${String(ccv).padStart(w.cv)} ║ ${diffStr.padStart(w.diff)} ║`);
      }

      // Client subtotal if multiple tipos
      if (allTipos.length > 1 || tv !== cv) {
        const diff = tv - cv;
        const diffStr = diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : `${diff}`);
        console.log(`║ ${''.padEnd(w.mes)} ║ ${''.padEnd(w.cli)} ║ ${'SUBTOTAL'.padEnd(w.tipo)} ║ ${String(tv).padStart(w.tv)} ║ ${String(cv).padStart(w.cv)} ║ ${diffStr.padStart(w.diff)} ║`);
      }
      console.log(`╟${'─'.repeat(w.mes+2)}╫${'─'.repeat(w.cli+2)}╫${'─'.repeat(w.tipo+2)}╫${'─'.repeat(w.tv+2)}╫${'─'.repeat(w.cv+2)}╫${'─'.repeat(w.diff+2)}╢`);
    }

    const mdiff = mesTotal_t - mesTotal_c;
    const mdiffStr = mdiff === 0 ? '✓' : (mdiff > 0 ? `+${mdiff}` : `${mdiff}`);
    console.log(`║ ${''.padEnd(w.mes)} ║ ${'TOTAL MES'.padEnd(w.cli)} ║ ${''.padEnd(w.tipo)} ║ ${String(mesTotal_t).padStart(w.tv)} ║ ${String(mesTotal_c).padStart(w.cv)} ║ ${mdiffStr.padStart(w.diff)} ║`);
    console.log(`╚${'═'.repeat(w.mes+2)}╩${'═'.repeat(w.cli+2)}╩${'═'.repeat(w.tipo+2)}╩${'═'.repeat(w.tv+2)}╩${'═'.repeat(w.cv+2)}╩${'═'.repeat(w.diff+2)}╝`);
  }

  await tango.end();
  await crm.end();
}
main().catch(e => { console.error(e); process.exit(1); });
