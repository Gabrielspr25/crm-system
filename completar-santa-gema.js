import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function completarSantaGema() {
  try {
    console.log('\n=== COMPLETANDO VENTA: COLEGIO SANTA GEMA ===\n');
    
    // Marcar follow_up como completado
    const result = await pool.query(`
      UPDATE follow_up_prospects
      SET completed_date = NOW()
      WHERE id = 83
      RETURNING *
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ Follow-up marcado como completado');
      console.log(`  ID: ${result.rows[0].id}`);
      console.log(`  Cliente: ${result.rows[0].company_name || 'N/A'}`);
      console.log(`  Fecha completado: ${result.rows[0].completed_date}`);
      
      console.log('\n✓ La venta ahora aparecerá en Reportes');
      console.log('  Puedes editar comisiones manualmente desde la pantalla de Reportes\n');
    } else {
      console.log('❌ No se encontró el follow_up con ID 83');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

completarSantaGema();
