import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function diagnosticoRapido() {
  try {
    console.log('\n=== DIAGNÓSTICO: Colegio Santa Gema ===\n');
    
    const result = await pool.query(`
      SELECT 
        c.id as client_id,
        c.name as client_name,
        c.salesperson_id,
        sp.name as salesperson_name,
        b.ban_number,
        s.phone,
        s.monthly_value,
        fup.id as followup_id,
        fup.completed_date
      FROM clients c
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN follow_up_prospects fup ON fup.client_id = c.id
      WHERE LOWER(c.name) LIKE '%santa gema%'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Cliente no encontrado\n');
      return;
    }
    
    const r = result.rows[0];
    
    console.log('DATOS ACTUALES:');
    console.log(`  Cliente: ${r.client_name}`);
    console.log(`  BAN: ${r.ban_number || '❌ NO TIENE'}`);
    console.log(`  Teléfono: ${r.phone || '❌ NO TIENE'}`);
    console.log(`  Mensualidad: $${r.monthly_value || '❌ NO TIENE'}`);
    console.log(`  Vendedor: ${r.salesperson_name || '❌ NO TIENE'} (${r.salesperson_id || 'NULL'})`);
    console.log(`  Follow-up completado: ${r.completed_date ? 'SÍ' : '❌ NO'}`);
    
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('PARA APARECER EN REPORTES NECESITA:');
    console.log('════════════════════════════════════════════════════════════\n');
    
    const problemas = [];
    
    if (!r.salesperson_id) {
      problemas.push('❌ 1. Asignar VENDEDOR al cliente');
      console.log('   SQL: UPDATE clients SET salesperson_id = \'UUID_VENDEDOR\' WHERE id = \'' + r.client_id + '\';');
    } else {
      console.log('✓ 1. Tiene vendedor asignado');
    }
    
    if (!r.monthly_value || r.monthly_value === 0) {
      problemas.push('❌ 2. Suscriptor necesita valor mensual (monthly_value)');
    } else {
      console.log('✓ 2. Tiene valor mensual: $' + r.monthly_value);
    }
    
    if (!r.completed_date) {
      problemas.push('❌ 3. Marcar follow-up como completado');
      console.log('   SQL: UPDATE follow_up_prospects SET completed_date = NOW() WHERE id = ' + r.followup_id + ';');
    } else {
      console.log('✓ 3. Follow-up completado');
    }
    
    if (problemas.length === 0) {
      console.log('\n✅ TODO LISTO - Debería aparecer en Reportes');
    } else {
      console.log('\n⚠️  FALTA COMPLETAR:');
      problemas.forEach(p => console.log('   ' + p));
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

diagnosticoRapido();
