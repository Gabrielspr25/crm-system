import { Router } from 'express';
import { Pool } from 'pg';
import crmPool from '../database/db.js';

const router = Router();

// Tango Legacy connection helper
function getTangoPool() {
  return new Pool({
    host: '167.99.12.125', port: 5432, user: 'postgres',
    password: 'fF00JIRFXc', database: 'claropr',
    connectionTimeoutMillis: 10000, max: 2,
  });
}

// ======================================================
// GET /api/tango/compare — Comparativa completa Tango vs CRM
// ======================================================
router.get('/compare', async (req, res) => {
  let legacyPool = null;
  try {
    const { search, month } = req.query;
    legacyPool = getTangoPool();

    // 1. Ventas PYMES de Tango
    let tangoQuery = `
      SELECT v.ventaid, v.ban, v.status as linea,
             v.ventatipoid, v.meses, v.fechaactivacion,
             COALESCE(v.comisionclaro, 0) as comisionclaro,
             COALESCE(v.comisionvendedor, 0) as comisionvendedor,
             v.codigovoz, v.activo, v.nota,
             COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
             vt.nombre as tipo, vd.nombre as vendedor
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      tangoQuery += ` AND (cc.nombre ILIKE $${params.length} OR v.ban ILIKE $${params.length} OR v.status ILIKE $${params.length})`;
    }
    if (month) {
      params.push(month);
      tangoQuery += ` AND TO_CHAR(v.fechaactivacion, 'YYYY-MM') = $${params.length}`;
    }
    tangoQuery += ` ORDER BY cc.nombre, v.ban, v.ventaid`;

    const tangoResult = await legacyPool.query(tangoQuery, params);

    // 2. CRM subscribers + reports para esos BANs
    const allBANs = [...new Set(tangoResult.rows.map(v => (v.ban || '').trim()).filter(Boolean))];

    let crmSubs = [];
    if (allBANs.length > 0) {
      const crmResult = await crmPool.query(`
        SELECT s.id as sub_id, s.phone, s.line_type,
               b.ban_number, b.id as ban_id, b.account_type,
               c.name as client_name, c.id as client_id,
               sr.report_month, sr.company_earnings, sr.vendor_commission, sr.paid_amount
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        JOIN clients c ON c.id = b.client_id
        LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id
        WHERE b.ban_number = ANY($1)
        ORDER BY b.ban_number, s.phone, sr.report_month
      `, [allBANs]);
      crmSubs = crmResult.rows;
    }

    // Also get CRM data for search that may not be in Tango
    let extraCrm = [];
    if (search) {
      const extraResult = await crmPool.query(`
        SELECT s.id as sub_id, s.phone, s.line_type,
               b.ban_number, b.id as ban_id, b.account_type,
               c.name as client_name, c.id as client_id,
               sr.report_month, sr.company_earnings, sr.vendor_commission, sr.paid_amount
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        JOIN clients c ON c.id = b.client_id
        LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id
        WHERE (c.name ILIKE $1 OR b.ban_number ILIKE $1 OR s.phone ILIKE $1)
          AND b.ban_number != ALL($2)
        ORDER BY b.ban_number, s.phone
      `, [`%${search}%`, allBANs]);
      extraCrm = extraResult.rows;
    }

    // 3. Build comparison by BAN+Month
    const comparison = buildComparison(tangoResult.rows, crmSubs, extraCrm);

    res.json({
      success: true,
      tango_total: tangoResult.rows.length,
      crm_total: crmSubs.length,
      comparison
    });

  } catch (error) {
    console.error('[TANGO-COMPARE] Error:', error);
    res.status(500).json({ error: 'Error comparando Tango vs CRM', details: error.message });
  } finally {
    if (legacyPool) try { await legacyPool.end(); } catch(e) {}
  }
});

// ======================================================
// GET /api/tango/detail/:ban — Detalle de un BAN específico
// ======================================================
router.get('/detail/:ban', async (req, res) => {
  let legacyPool = null;
  try {
    const { ban } = req.params;
    legacyPool = getTangoPool();

    // Tango ventas para este BAN (incluye inactivas)
    const tangoResult = await legacyPool.query(`
      SELECT v.ventaid, v.ban, v.status as linea,
             v.ventatipoid, v.meses, v.fechaactivacion,
             COALESCE(v.comisionclaro, 0) as comisionclaro,
             COALESCE(v.comisionvendedor, 0) as comisionvendedor,
             v.codigovoz, v.activo, v.nota, v.renovacion, v.fijo,
             COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
             vt.nombre as tipo, vd.nombre as vendedor
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
      WHERE v.ban = $1
        AND v.ventatipoid IN (138, 139, 140, 141)
      ORDER BY v.fechaactivacion, v.ventaid
    `, [ban]);

    // Buscar comision de tabla comision para cada venta
    const ventasConComision = [];
    for (const v of tangoResult.rows) {
      // Buscar rate del plan
      const tpResult = await legacyPool.query(
        `SELECT rate FROM tipoplan WHERE codigovoz = $1 LIMIT 1`, [v.codigovoz]
      );
      let comisionTabla = null;
      if (tpResult.rows.length > 0) {
        const rate = parseFloat(tpResult.rows[0].rate);
        const comResult = await legacyPool.query(`
          SELECT comisionclaro, meses as com_meses, ratemin, ratemax, fechadesde, fechahasta
          FROM comision
          WHERE ventatipoid = $1
            AND ratemin <= $2 AND ratemax >= $2
            AND ($3::int = meses OR meses = 0)
            AND fechadesde <= $4 AND fechahasta >= $4
          ORDER BY meses DESC LIMIT 1
        `, [v.ventatipoid, rate, v.meses, v.fechaactivacion]);
        if (comResult.rows.length > 0) {
          comisionTabla = parseFloat(comResult.rows[0].comisionclaro);
        }
      }

      ventasConComision.push({
        ...v,
        plan_rate: tpResult.rows.length > 0 ? parseFloat(tpResult.rows[0].rate) : null,
        comision_calculada: comisionTabla
      });
    }

    // CRM data for this BAN
    const crmResult = await crmPool.query(`
      SELECT s.id as sub_id, s.phone, s.line_type, s.created_at,
             b.ban_number, b.account_type,
             c.name as client_name,
             sr.report_month, sr.company_earnings, sr.vendor_commission, sr.paid_amount
      FROM subscribers s
      JOIN bans b ON b.id = s.ban_id
      JOIN clients c ON c.id = b.client_id
      LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id
      WHERE b.ban_number = $1
      ORDER BY s.phone, sr.report_month
    `, [ban]);

    res.json({
      success: true,
      ban,
      tango: ventasConComision,
      crm: crmResult.rows
    });

  } catch (error) {
    console.error('[TANGO-DETAIL] Error:', error);
    res.status(500).json({ error: 'Error obteniendo detalle', details: error.message });
  } finally {
    if (legacyPool) try { await legacyPool.end(); } catch(e) {}
  }
});

// ======================================================
// GET /api/tango/summary — Resumen mensual Tango vs CRM
// ======================================================
router.get('/summary', async (req, res) => {
  let legacyPool = null;
  try {
    legacyPool = getTangoPool();

    const tangoResult = await legacyPool.query(`
      SELECT TO_CHAR(v.fechaactivacion, 'YYYY-MM') as month,
             vt.nombre as tipo, v.ventatipoid,
             COUNT(*) as count
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      WHERE v.ventatipoid IN (138, 139, 140, 141) AND v.activo = true
      GROUP BY TO_CHAR(v.fechaactivacion, 'YYYY-MM'), vt.nombre, v.ventatipoid
      ORDER BY month, v.ventatipoid
    `);

    const crmResult = await crmPool.query(`
      SELECT TO_CHAR(sr.report_month, 'YYYY-MM') as month,
             s.line_type,
             b.account_type,
             COUNT(*) as count
      FROM subscriber_reports sr
      JOIN subscribers s ON s.id = sr.subscriber_id
      JOIN bans b ON b.id = s.ban_id
      GROUP BY TO_CHAR(sr.report_month, 'YYYY-MM'), s.line_type, b.account_type
      ORDER BY month
    `);

    // Group by month
    const months = {};

    for (const r of tangoResult.rows) {
      if (!months[r.month]) months[r.month] = { tango: {}, crm: {}, tango_total: 0, crm_total: 0 };
      const key = `${r.tipo} (${r.ventatipoid})`;
      months[r.month].tango[key] = parseInt(r.count);
      months[r.month].tango_total += parseInt(r.count);
    }

    for (const r of crmResult.rows) {
      if (!months[r.month]) months[r.month] = { tango: {}, crm: {}, tango_total: 0, crm_total: 0 };
      const key = `${r.account_type || 'N/A'} ${r.line_type || 'N/A'}`;
      months[r.month].crm[key] = (months[r.month].crm[key] || 0) + parseInt(r.count);
      months[r.month].crm_total += parseInt(r.count);
    }

    res.json({ success: true, months });

  } catch (error) {
    console.error('[TANGO-SUMMARY] Error:', error);
    res.status(500).json({ error: 'Error generando resumen', details: error.message });
  } finally {
    if (legacyPool) try { await legacyPool.end(); } catch(e) {}
  }
});

// ======================================================
// Helper: Build comparison structure
// ======================================================
function buildComparison(tangoVentas, crmSubs, extraCrm) {
  const byBanMonth = {};

  // Process Tango ventas
  for (const v of tangoVentas) {
    const ban = (v.ban || '').trim();
    const month = v.fechaactivacion ? new Date(v.fechaactivacion).toISOString().slice(0, 7) : 'unknown';
    const key = `${ban}|${month}`;

    if (!byBanMonth[key]) {
      byBanMonth[key] = {
        ban, month,
        cliente: v.cliente,
        tango_count: 0, crm_count: 0,
        tango_ventas: [],
        crm_subs: [],
        status: 'pending' // match, partial, missing_crm, missing_tango
      };
    }
    byBanMonth[key].tango_count++;
    byBanMonth[key].tango_ventas.push({
      ventaid: v.ventaid,
      tipo: v.tipo,
      ventatipoid: v.ventatipoid,
      linea: v.linea,
      codigovoz: v.codigovoz,
      comisionclaro: parseFloat(v.comisionclaro),
      vendedor: v.vendedor,
      fecha: v.fechaactivacion
    });
  }

  // Process CRM subs
  const crmProcessed = new Set();
  for (const s of crmSubs) {
    const ban = (s.ban_number || '').trim();
    const month = s.report_month ? new Date(s.report_month).toISOString().slice(0, 7) : null;
    if (!month) continue;
    const key = `${ban}|${month}`;
    const subKey = `${s.sub_id}|${month}`;
    if (crmProcessed.has(subKey)) continue;
    crmProcessed.add(subKey);

    if (!byBanMonth[key]) {
      byBanMonth[key] = {
        ban, month,
        cliente: s.client_name,
        tango_count: 0, crm_count: 0,
        tango_ventas: [],
        crm_subs: [],
        status: 'pending'
      };
    }
    byBanMonth[key].crm_count++;
    byBanMonth[key].crm_subs.push({
      sub_id: s.sub_id,
      phone: s.phone,
      line_type: s.line_type,
      account_type: s.account_type,
      company_earnings: parseFloat(s.company_earnings || 0),
      vendor_commission: parseFloat(s.vendor_commission || 0)
    });
  }

  // Extra CRM (not in Tango)
  for (const s of extraCrm) {
    const ban = (s.ban_number || '').trim();
    const month = s.report_month ? new Date(s.report_month).toISOString().slice(0, 7) : 'no-report';
    const key = `${ban}|${month}`;
    const subKey = `${s.sub_id}|${month}`;
    if (crmProcessed.has(subKey)) continue;
    crmProcessed.add(subKey);

    if (!byBanMonth[key]) {
      byBanMonth[key] = {
        ban, month,
        cliente: s.client_name,
        tango_count: 0, crm_count: 0,
        tango_ventas: [],
        crm_subs: [],
        status: 'pending'
      };
    }
    byBanMonth[key].crm_count++;
    byBanMonth[key].crm_subs.push({
      sub_id: s.sub_id,
      phone: s.phone,
      line_type: s.line_type,
      account_type: s.account_type,
      company_earnings: parseFloat(s.company_earnings || 0),
      vendor_commission: parseFloat(s.vendor_commission || 0)
    });
  }

  // Determine status
  for (const item of Object.values(byBanMonth)) {
    if (item.tango_count === item.crm_count && item.tango_count > 0) {
      item.status = 'match';
    } else if (item.tango_count > 0 && item.crm_count === 0) {
      item.status = 'missing_crm';
    } else if (item.tango_count === 0 && item.crm_count > 0) {
      item.status = 'missing_tango';
    } else if (item.tango_count !== item.crm_count) {
      item.status = 'partial';
    }
  }

  // Sort by month, then client, then ban
  return Object.values(byBanMonth).sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    if (a.cliente !== b.cliente) return a.cliente.localeCompare(b.cliente);
    return a.ban.localeCompare(b.ban);
  });
}

export default router;
