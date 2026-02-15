import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function checkHistory() {
  const clientId = '0ee67ba2-8a34-4623-a483-f2c582122afd'; // HOGAR ALBERGUE
  
  const result = await pool.query(`
    SELECT 
      id,
      subscriber_id,
      company_name,
      monthly_value,
      sale_date,
      notes
    FROM sales_history
    WHERE client_id = $1
    ORDER BY sale_date DESC
  `, [clientId]);
  
  console.log(`\n📊 Historial de ventas para HOGAR ALBERGUE (${result.rows.length} registros):\n`);
  
  result.rows.forEach((row, i) => {
    console.log(`  [${i+1}] ID: ${row.id}`);
    console.log(`      Subscriber: ${row.subscriber_id}`);
    console.log(`      Valor mensual: $${row.monthly_value}`);
    console.log(`      Fecha venta: ${row.sale_date}`);
    console.log(`      Notas: ${row.notes}\n`);
  });
  
  await pool.end();
}

checkHistory();
