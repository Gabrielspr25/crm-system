import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verificarFechaActivacion() {
  try {
    console.log('\n=== VERIFICANDO FECHA DE ACTIVACIÓN ===\n');
    
    const result = await pool.query(`
      SELECT 
        c.name as cliente,
        b.ban_number,
        b.activation_date as fecha_activacion_ban,
        b.created_at as fecha_creacion_ban,
        s.phone,
        s.contract_term as meses,
        s.contract_end_date as vencimiento_actual,
        s.created_at as fecha_creacion_suscriptor
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      WHERE c.name ILIKE '%santa gema%'
    `);

    if (result.rows.length === 0) {
      console.log('❌ No encontrado');
      return;
    }

    const v = result.rows[0];
    console.log('DATOS ACTUALES:');
    console.log(`Cliente: ${v.cliente}`);
    console.log(`BAN: ${v.ban_number}`);
    console.log(`Fecha Activación BAN: ${v.fecha_activacion_ban || '❌ NO TIENE'}`);
    console.log(`Fecha Creación BAN: ${v.fecha_creacion_ban.toISOString().split('T')[0]}`);
    console.log(`Suscriptor: ${v.phone}`);
    console.log(`Duración contrato: ${v.meses} meses`);
    console.log(`Vencimiento actual: ${v.vencimiento_actual.toISOString().split('T')[0]}`);
    
    console.log('\n═══════════════════════════════════════');
    console.log('⚠️  PROBLEMA DETECTADO:');
    console.log('  • Vencimiento está calculado desde HOY (2026-02-03)');
    console.log('  • Debería calcularse desde FECHA DE ACTIVACIÓN');
    console.log('\n¿Cuál es la fecha de activación correcta?');
    console.log('  (De la pantalla legacy viste: 01/27/2026)');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

verificarFechaActivacion();
