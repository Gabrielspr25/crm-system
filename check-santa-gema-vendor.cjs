const { Pool } = require('pg');

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT 
        fup.id,
        fup.company_name,
        fup.client_id,
        fup.vendor_id,
        c.name as client_name,
        c.salesperson_id,
        sp.name as salesperson_name
      FROM follow_up_prospects fup
      LEFT JOIN clients c ON fup.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      WHERE fup.company_name LIKE '%Santa Gema%'
    `);
    
    console.log('Prospecto Colegio Santa Gema:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('\n--- ANÁLISIS ---');
      console.log('Follow-up vendor_id:', row.vendor_id);
      console.log('Cliente salesperson_id:', row.salesperson_id);
      console.log('Salesperson name:', row.salesperson_name);
      
      if (!row.vendor_id && row.salesperson_id) {
        console.log('\n⚠️ EL PROSPECTO NO TIENE VENDOR_ID PERO EL CLIENTE SÍ TIENE SALESPERSON');
        console.log('Necesitamos copiar/mapear el salesperson al vendor del prospecto');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
