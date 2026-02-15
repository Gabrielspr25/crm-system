const { Pool } = require('pg');
const p = new Pool({
  host: '143.244.191.139', port: 5432,
  database: 'crm_pro', user: 'crm_user', password: 'CRM_Seguro_2025!'
});

async function main() {
  const r = await p.query(`
    SELECT sh.vendor_id, v.name,
      SUM(sh.fijo_ren) as fijo_ren, SUM(sh.fijo_new) as fijo_new,
      SUM(sh.movil_nueva) as movil_new, SUM(sh.movil_renovacion) as movil_ren,
      SUM(sh.claro_tv) as claro_tv, SUM(sh.cloud) as cloud,
      SUM(sh.total_amount) as total, SUM(sh.monthly_value) as monthly_val,
      COUNT(*) as cnt
    FROM sales_history sh
    LEFT JOIN vendors v ON sh.vendor_id = v.id
    WHERE sh.sale_date >= '2026-01-01'
    GROUP BY sh.vendor_id, v.name ORDER BY v.name
  `);
  console.table(r.rows);

  // Also check a few raw rows
  const r2 = await p.query(`SELECT id, company_name, vendor_id, total_amount, monthly_value, fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, sale_date FROM sales_history ORDER BY id DESC LIMIT 5`);
  console.table(r2.rows);

  p.end();
}
main().catch(e => { console.error(e.message); p.end(); });
