import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verificarReportes() {
  try {
    console.log('\n=== VERIFICANDO SI ESTÁ EN REPORTES ===\n');
    
    // Buscar follow_up_prospect
    const followUp = await pool.query(`
      SELECT fp.id, fp.company_name, fp.fijo_new
      FROM follow_up_prospects fp
      JOIN clients c ON c.id = fp.client_id
      WHERE c.name ILIKE '%santa gema%' AND fp.is_active = true
    `);
    
    if (followUp.rows.length === 0) {
      console.log('❌ No está en follow_up_prospects');
      return;
    }
    
    const fpId = followUp.rows[0].id;
    console.log(`✓ Follow-up ID: ${fpId}`);
    console.log(`  Empresa: ${followUp.rows[0].company_name}`);
    console.log(`  Fijo New: ${followUp.rows[0].fijo_new}`);
    
    // Buscar en sales_reports
    console.log('\n=== BUSCANDO EN SALES_REPORTS ===\n');
    
    const reporte = await pool.query(`
      SELECT * FROM sales_reports WHERE follow_up_prospect_id = $1
    `, [fpId]);
    
    if (reporte.rows.length === 0) {
      console.log('❌ NO está en sales_reports');
      console.log('\n¿Crear reporte ahora? Necesito:');
      console.log('  • follow_up_prospect_id: ' + fpId);
      console.log('  • vendor_id: (buscar en vendors)');
    } else {
      console.log('✓ SÍ está en sales_reports:');
      const r = reporte.rows[0];
      console.log(`  ID: ${r.id}`);
      console.log(`  Empresa: ${r.company_name}`);
      console.log(`  Monto: $${r.total_amount}`);
      console.log(`  Fecha: ${r.sale_date}`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

verificarReportes();
