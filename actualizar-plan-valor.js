import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function actualizarPlanYValor() {
  try {
    console.log('\n=== ACTUALIZANDO PLAN Y VALOR MENSUAL ===');
    
    const result = await pool.query(`
      UPDATE subscribers 
      SET 
        plan = $1,
        monthly_value = $2
      WHERE ban_id IN (
        SELECT b.id 
        FROM bans b 
        JOIN clients c ON c.id = b.client_id
        WHERE c.name ILIKE '%santa gema%'
      )
      RETURNING id, phone, plan, monthly_value, contract_term
    `, ['RED3535', 27.08]);

    if (result.rows.length > 0) {
      const s = result.rows[0];
      console.log('✅ ACTUALIZADO:');
      console.log(`  Teléfono: ${s.phone}`);
      console.log(`  Plan: ${s.plan}`);
      console.log(`  Valor Mensual: $${s.monthly_value}`);
      console.log(`  Duración: ${s.contract_term} meses`);
    } else {
      console.log('❌ No se encontró suscriptor');
    }

    console.log('\n═══════════════════════════════════════');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

actualizarPlanYValor();
