import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function fixTelefono() {
  try {
    console.log('\n=== CORRIGIENDO TELÉFONO SUSCRIPTOR ===');
    
    // Actualizar teléfono
    const result = await pool.query(`
      UPDATE subscribers 
      SET phone = $1 
      WHERE phone = $2
      RETURNING id, phone, line_type, contract_end_date
    `, ['939-777-0017', '7877001234']);
    
    if (result.rows.length > 0) {
      console.log('✅ Teléfono actualizado:');
      console.log(`   Anterior: 7877001234`);
      console.log(`   Nuevo:    ${result.rows[0].phone}`);
      console.log(`   Tipo:     ${result.rows[0].line_type}`);
      console.log(`   Vence:    ${result.rows[0].contract_end_date || 'Sin fecha'}`);
    } else {
      console.log('⚠️  No se encontró suscriptor con teléfono 7877001234');
    }
    
    // Verificar datos completos
    console.log('\n=== VERIFICACIÓN FINAL ===');
    const verificacion = await pool.query(`
      SELECT 
        c.name as cliente,
        b.ban_number,
        b.account_type,
        s.phone as suscriptor,
        s.line_type,
        s.contract_end_date
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      WHERE c.name ILIKE '%santa gema%'
      ORDER BY c.created_at DESC
      LIMIT 1
    `);
    
    if (verificacion.rows.length > 0) {
      const v = verificacion.rows[0];
      console.log('\n📊 DATOS ACTUALES:');
      console.log('─────────────────────────────────────');
      console.log(`Cliente:     ${v.cliente}`);
      console.log(`BAN:         ${v.ban_number}`);
      console.log(`Tipo BAN:    ${v.account_type || '(Sin tipo - BD legacy no lo tiene)'}`);
      console.log(`Suscriptor:  ${v.suscriptor}`);
      console.log(`Tipo Línea:  ${v.line_type}`);
      console.log(`Vencimiento: ${v.contract_end_date ? v.contract_end_date.toISOString().split('T')[0] : 'Sin fecha'}`);
      console.log('─────────────────────────────────────');
      console.log('\n✅ Ahora refresca la página de Clientes para ver el cambio!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixTelefono();
