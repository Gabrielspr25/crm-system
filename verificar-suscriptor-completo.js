import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verificarSuscriptor() {
  try {
    const result = await pool.query(`
      SELECT 
        c.name as cliente,
        s.phone,
        s.contract_term as meses,
        s.monthly_value as valor_mensual,
        s.plan
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      WHERE c.name ILIKE '%santa gema%'
      ORDER BY c.created_at DESC
    `);

    console.log('\n═══ VERIFICACIÓN DE SUSCRIPTOR ═══');
    
    if (result.rows.length === 0) {
      console.log('❌ No se encontró suscriptor');
      return;
    }

    const s = result.rows[0];
    console.log(`\nCliente: ${s.cliente}`);
    console.log(`Teléfono: ${s.phone}`);
    console.log(`Plan: ${s.plan || 'Sin plan'}`);
    console.log(`\n¿Tiene los meses? ${s.meses ? 'SÍ - ' + s.meses + ' meses' : 'NO - null'}`);
    console.log(`¿Tiene valor mensual? ${s.valor_mensual ? 'SÍ - $' + s.valor_mensual : 'NO - null o 0'}`);
    
    console.log('\n═══════════════════════════════════');
    
    if (!s.meses || s.meses !== 24 || !s.valor_mensual || parseFloat(s.valor_mensual) === 0) {
      console.log('\n⚠️  REQUIERE CORRECCIÓN');
      console.log('\n¿Proceder a actualizar?');
      console.log('  - Duración: 24 meses');
      console.log('  - Valor mensual: ¿Cuánto debe ser?');
    } else {
      console.log('\n✅ DATOS CORRECTOS');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

verificarSuscriptor();
