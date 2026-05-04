import { query } from '../database/db.js';

// GET /api/gestion/goals?year=&month=
export async function getGoals(req, res) {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year y month requeridos' });
    const y = parseInt(year), m = parseInt(month);

    const bizRows = await query(
      `SELECT product_id, target_amount FROM business_goals WHERE period_year=$1 AND period_month=$2`,
      [y, m]
    );
    const business = {};
    bizRows.forEach(r => { business[r.product_id] = parseFloat(r.target_amount); });

    const vendorRows = await query(
      `SELECT
         pg.vendor_id,
         v.name as vendor_name,
         pg.description as product_id,
         pg.target_revenue as amount,
         p.name AS product_name,
         sp.id::text AS salesperson_id
       FROM product_goals pg
       JOIN vendors v ON v.id = pg.vendor_id
       LEFT JOIN products p ON p.id::text = pg.description
       LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = pg.vendor_id
       LEFT JOIN salespeople sp ON sp.id = vsm.salesperson_id
       WHERE pg.period_year=$1 AND pg.period_month=$2
       ORDER BY v.name`,
      [y, m]
    );
    const vendorsMap = {};
    vendorRows.forEach(r => {
      if (!vendorsMap[r.vendor_id]) {
        vendorsMap[r.vendor_id] = {
          vendor_id: r.vendor_id,
          vendor_name: r.vendor_name,
          salesperson_id: r.salesperson_id || null,
          goals: {},
          goalsByName: {},
        };
      }
      const v = vendorsMap[r.vendor_id];
      v.goals[r.product_id] = parseFloat(r.amount);
      if (r.product_name) v.goalsByName[r.product_name] = parseFloat(r.amount);
    });

    res.json({ business, vendors: Object.values(vendorsMap) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// POST /api/gestion/goals/business  { product_id, period_year, period_month, amount }
export async function saveBusinessGoal(req, res) {
  try {
    const { product_id, period_year, period_month, amount } = req.body;
    const amt = parseFloat(amount) || 0;
    if (amt === 0) {
      await query(`DELETE FROM business_goals WHERE product_id=$1 AND period_year=$2 AND period_month=$3`,
        [product_id, period_year, period_month]);
    } else {
      await query(
        `INSERT INTO business_goals (product_id, period_year, period_month, target_amount, created_at, updated_at)
         VALUES ($1,$2,$3,$4,NOW(),NOW())
         ON CONFLICT (product_id, period_year, period_month)
         DO UPDATE SET target_amount=EXCLUDED.target_amount, updated_at=NOW()`,
        [product_id, parseInt(period_year), parseInt(period_month), amt]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// POST /api/gestion/goals/vendor  { vendor_id, product_id, period_year, period_month, amount }
export async function saveVendorGoal(req, res) {
  try {
    const { vendor_id, product_id, period_year, period_month, amount } = req.body;
    const amt = parseFloat(amount) || 0;
    const productIdInt = Math.abs(product_id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)) % 2147483647;

    if (amt === 0) {
      await query(`DELETE FROM product_goals WHERE vendor_id=$1 AND product_id=$2 AND period_year=$3 AND period_month=$4`,
        [vendor_id, productIdInt, period_year, period_month]);
    } else {
      await query(
        `INSERT INTO product_goals (vendor_id, product_id, period_type, period_year, period_month, target_revenue, is_active, description, created_at, updated_at)
         VALUES ($1,$2,'monthly',$3,$4,$5,1,$6,NOW(),NOW())
         ON CONFLICT (vendor_id, product_id, period_year, period_month) WHERE vendor_id IS NOT NULL
         DO UPDATE SET target_revenue=EXCLUDED.target_revenue, description=EXCLUDED.description, updated_at=NOW()`,
        [vendor_id, productIdInt, parseInt(period_year), parseInt(period_month), amt, product_id]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
