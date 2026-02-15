import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function probarVentaCompleta() {
  try {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║   PRUEBA FINAL - VENTA COMPLETA      ║');
    console.log('╚═══════════════════════════════════════╝\n');
    
    const result = await pool.query(`
      SELECT 
        c.name as cliente,
        b.ban_number,
        b.account_type,
        s.phone as suscriptor,
        s.plan,
        s.monthly_value,
        s.contract_term as meses,
        s.contract_end_date as vencimiento,
        CASE WHEN fp.id IS NOT NULL THEN 'SÍ' ELSE 'NO' END as en_seguimiento
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN follow_up_prospects fp ON fp.client_id = c.id AND fp.is_active = true
      WHERE c.name ILIKE '%santa gema%'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Venta no encontrada\n');
      return;
    }

    const v = result.rows[0];
    
    console.log('📋 DATOS DE LA VENTA:');
    console.log('─────────────────────────────────────');
    console.log(`Cliente:        ${v.cliente}`);
    console.log(`BAN:            ${v.ban_number}`);
    console.log(`Tipo BAN:       ${v.account_type}`);
    console.log(`Suscriptor:     ${v.suscriptor}`);
    console.log(`Plan:           ${v.plan || '❌ FALTA'}`);
    console.log(`Valor Mensual:  $${v.monthly_value || '❌ FALTA'}`);
    console.log(`Duración:       ${v.meses || '❌ FALTA'} meses`);
    console.log(`Vencimiento:    ${v.vencimiento ? v.vencimiento.toISOString().split('T')[0] : '❌ FALTA'}`);
    console.log(`En Seguimiento: ${v.en_seguimiento}`);
    console.log('─────────────────────────────────────');
    
    // Validaciones
    console.log('\n✓ VALIDACIONES:');
    
    const validaciones = [
      { nombre: 'Cliente existe', ok: !!v.cliente },
      { nombre: 'BAN existe', ok: !!v.ban_number },
      { nombre: 'Suscriptor existe', ok: !!v.suscriptor },
      { nombre: 'Plan asignado', ok: !!v.plan },
      { nombre: 'Valor mensual > 0', ok: v.monthly_value > 0 },
      { nombre: 'Duración = 24 meses', ok: v.meses === 24 },
      { nombre: 'Fecha vencimiento', ok: !!v.vencimiento },
      { nombre: 'En seguimiento', ok: v.en_seguimiento === 'SÍ' }
    ];
    
    let todoOk = true;
    validaciones.forEach(val => {
      const icon = val.ok ? '✅' : '❌';
      console.log(`  ${icon} ${val.nombre}`);
      if (!val.ok) todoOk = false;
    });
    
    console.log('\n' + '═'.repeat(41));
    if (todoOk) {
      console.log('✅ VENTA COMPLETA Y CORRECTA');
    } else {
      console.log('⚠️  FALTAN DATOS POR COMPLETAR');
    }
    console.log('═'.repeat(41) + '\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

probarVentaCompleta();
