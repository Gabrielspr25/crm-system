
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'crm_user',
  host: 'localhost',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
});

async function fixOgoyi() {
  console.log('🔧 Corrigiendo Ogoyi...');
  
  try {
    // Actualizar a los valores correctos: 2 líneas, $150 total
    await pool.query(`
      UPDATE follow_up_prospects 
      SET movil_renovacion = '2.00', 
          total_amount = '150.00'
      WHERE company_name ILIKE '%OGOYI%' AND is_completed = true
    `);
    
    console.log('✅ Ogoyi actualizado: 2 líneas, $150 total, comisión será $75');
    
    // Verificar
    const check = await pool.query(`
      SELECT id, company_name, movil_renovacion, total_amount 
      FROM follow_up_prospects 
      WHERE company_name ILIKE '%OGOYI%'
    `);
    console.table(check.rows);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

fixOgoyi();
