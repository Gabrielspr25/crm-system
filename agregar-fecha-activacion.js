import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function agregarYActualizarFechaActivacion() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('\n=== 1. CAMPO activation_date YA EXISTE ===');
    console.log('✓ Campo agregado previamente');
    
    console.log('\n=== 2. ACTUALIZANDO FECHA DE ACTIVACIÓN ===');
    
    // Actualizar BAN con fecha de activación
    await client.query(`
      UPDATE bans 
      SET activation_date = $1
      WHERE ban_number = $2
    `, ['2026-01-27', '719400825']);
    
    console.log('✓ Fecha activación: 2026-01-27');
    
    console.log('\n=== 3. RECALCULANDO VENCIMIENTO ===');
    
    // Calcular vencimiento: 01/27/2026 + 24 meses = 01/27/2028
    const fechaVencimiento = new Date('2026-01-27');
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 24);
    
    await client.query(`
      UPDATE subscribers 
      SET contract_end_date = $1
      WHERE ban_id IN (
        SELECT id FROM bans WHERE ban_number = $2
      )
    `, [fechaVencimiento, '719400825']);
    
    console.log(`✓ Vencimiento recalculado: ${fechaVencimiento.toISOString().split('T')[0]}`);
    
    await client.query('COMMIT');
    
    console.log('\n=== 4. VERIFICACIÓN FINAL ===');
    
    const result = await client.query(`
      SELECT 
        c.name,
        b.ban_number,
        b.activation_date,
        s.phone,
        s.contract_term,
        s.contract_end_date
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      WHERE b.ban_number = '719400825'
    `);
    
    const v = result.rows[0];
    console.log('\n📊 DATOS FINALES:');
    console.log('═══════════════════════════════════════');
    console.log(`Cliente:           ${v.name}`);
    console.log(`BAN:               ${v.ban_number}`);
    console.log(`Activación:        ${v.activation_date.toISOString().split('T')[0]} ✓`);
    console.log(`Suscriptor:        ${v.phone}`);
    console.log(`Duración:          ${v.contract_term} meses`);
    console.log(`Vencimiento:       ${v.contract_end_date.toISOString().split('T')[0]} ✓`);
    console.log('═══════════════════════════════════════');
    
    console.log('\n✅ Fechas actualizadas correctamente');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

agregarYActualizarFechaActivacion();
