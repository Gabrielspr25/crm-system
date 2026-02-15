import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

const crmPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function obtenerYActualizarPlan() {
  try {
    console.log('\n=== 1. BUSCANDO PLAN RED3535 EN LEGACY ===');
    
    const planLegacy = await legacyPool.query(`
      SELECT codigovoz, rate
      FROM tipoplan
      WHERE codigovoz = $1
      LIMIT 1
    `, ['RED3535']);
    
    if (planLegacy.rows.length === 0) {
      console.log('❌ Plan RED3535 no encontrado en tipoplan');
      return;
    }
    
    const valorMensual = planLegacy.rows[0].rate;
    console.log(`✓ Plan encontrado: ${planLegacy.rows[0].codigovoz}`);
    console.log(`✓ Valor mensual (rate): $${valorMensual}`);
    
    console.log('\n=== 2. ACTUALIZANDO SUSCRIPTOR EN CRM ===');
    
    const updateResult = await crmPool.query(`
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
      RETURNING phone, plan, monthly_value, contract_term
    `, ['RED3535', valorMensual]);
    
    if (updateResult.rows.length > 0) {
      const s = updateResult.rows[0];
      console.log('✅ SUSCRIPTOR ACTUALIZADO:');
      console.log(`  Teléfono: ${s.phone}`);
      console.log(`  Plan: ${s.plan}`);
      console.log(`  Valor Mensual: $${s.monthly_value}`);
      console.log(`  Duración: ${s.contract_term} meses`);
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Proceso completado');
    console.log('Refresca /clients para ver los cambios');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
    await crmPool.end();
  }
}

obtenerYActualizarPlan();
