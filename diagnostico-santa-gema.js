import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verificarSantaGema() {
  try {
    console.log('\n=== VERIFICANDO COLEGIO SANTA GEMA ===\n');
    
    // Cliente
    const cliente = await pool.query(`
      SELECT id, name, salesperson_id
      FROM clients 
      WHERE LOWER(name) LIKE '%santa gema%'
    `);
    
    if (cliente.rows.length === 0) {
      console.log('❌ Cliente no encontrado');
      return;
    }
    
    const c = cliente.rows[0];
    console.log('CLIENTE:');
    console.log(`  Nombre: ${c.name}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Vendedor: ${c.salesperson_id || '❌ NO TIENE'}\n`);
    
    // BAN
    const ban = await pool.query(`
      SELECT * FROM bans WHERE client_id = $1
    `, [c.id]);
    
    console.log('BAN:');
    if (ban.rows.length > 0) {
      console.log(`  Número: ${ban.rows[0].ban_number}`);
    } else {
      console.log('  ❌ Sin BAN');
    }
    
    // Suscriptor
    const subs = await pool.query(`
      SELECT s.* FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      WHERE b.client_id = $1
    `, [c.id]);
    
    console.log('\nSUSCRIPTOR:');
    if (subs.rows.length > 0) {
      const s = subs.rows[0];
      console.log(`  Teléfono: ${s.phone}`);
      console.log(`  Plan: ${s.plan_name || '❌ NO TIENE'}`);
      console.log(`  Valor mensual: $${s.monthly_value || '❌ NO TIENE'}`);
      console.log(`  Duración: ${s.contract_duration || '❌ NO TIENE'} meses`);
    } else {
      console.log('  ❌ Sin suscriptor');
    }
    
    // Follow-up
    const followUp = await pool.query(`
      SELECT * FROM follow_up_prospects WHERE client_id = $1
    `, [c.id]);
    
    console.log('\nFOLLOW-UP:');
    if (followUp.rows.length > 0) {
      const f = followUp.rows[0];
      console.log(`  ID: ${f.id}`);
      console.log(`  Completado: ${f.completed_date ? 'SÍ' : '❌ NO'}`);
    } else {
      console.log('  ❌ Sin follow-up');
    }
    
    // DIAGNÓSTICO
    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('DIAGNÓSTICO - QUÉ FALTA PARA PASAR A REPORTES:');
    console.log('════════════════════════════════════════════════════════════');
    
    const problemas = [];
    
    if (!c.salesperson_id) {
      problemas.push('1. ❌ Cliente sin vendedor (salesperson_id)');
    } else {
      console.log('1. ✓ Cliente tiene vendedor');
    }
    
    if (subs.rows.length > 0) {
      const s = subs.rows[0];
      if (!s.monthly_value || s.monthly_value === 0) {
        problemas.push('2. ❌ Suscriptor sin valor mensual');
      } else {
        console.log(`2. ✓ Suscriptor tiene valor: $${s.monthly_value}`);
      }
      
      if (!s.contract_duration) {
        problemas.push('3. ⚠️  Suscriptor sin duración de contrato (opcional)');
      } else {
        console.log(`3. ✓ Duración: ${s.contract_duration} meses`);
      }
    }
    
    if (followUp.rows.length > 0 && !followUp.rows[0].completed_date) {
      problemas.push('4. ❌ Follow-up no marcado como completado');
    } else if (followUp.rows.length > 0) {
      console.log('4. ✓ Follow-up completado');
    }
    
    if (problemas.length > 0) {
      console.log('\n⚠️  PROBLEMAS ENCONTRADOS:\n');
      problemas.forEach(p => console.log('   ' + p));
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

verificarSantaGema();
