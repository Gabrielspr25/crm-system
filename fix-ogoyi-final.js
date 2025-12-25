
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'crm_user',
  host: 'localhost',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
});

async function fixOgoyiFinal() {
  console.log('🔧 Corrección FINAL de Ogoyi...');
  
  try {
    // Actualizar: movil_renovacion debe ser el VALOR ($150), no la cantidad (2)
    await pool.query(`
      UPDATE follow_up_prospects 
      SET movil_renovacion = '150.00'
      WHERE company_name ILIKE '%OGOYI%' AND is_completed = true
    `);
    
    console.log('✅ Ogoyi corregido:');
    console.log('   - Móvil Renovación: $150 (2 líneas × $75)');
    console.log('   - Total: $150');
    console.log('   - Comisión (50%): $75');
    
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

fixOgoyiFinal();
