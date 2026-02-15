import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function completarVentaFinal() {
  const client = await pool.connect();
  
  try {
    // 1. Buscar cliente
    const clienteResult = await client.query(
      `SELECT id, name FROM clients WHERE name ILIKE '%santa gema%' ORDER BY created_at DESC LIMIT 1`
    );
    
    const clienteId = clienteResult.rows[0].id;
    console.log(`\n✓ Cliente: ${clienteResult.rows[0].name}`);

    // 2. Actualizar suscriptor a 24 meses
    console.log('\n=== ACTUALIZANDO A 24 MESES ===');
    const vencimiento24 = new Date();
    vencimiento24.setMonth(vencimiento24.getMonth() + 24);
    
    const updateSub = await client.query(`
      UPDATE subscribers 
      SET 
        contract_end_date = $1,
        contract_term = 24
      WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $2)
      RETURNING phone, contract_term, contract_end_date
    `, [vencimiento24, clienteId]);
    
    console.log(`✓ Duración: ${updateSub.rows[0].contract_term} meses`);
    console.log(`✓ Vence: ${updateSub.rows[0].contract_end_date.toISOString().split('T')[0]}`);

    // 3. Agregar a Seguimiento
    console.log('\n=== AGREGANDO A SEGUIMIENTO ===');
    const existeSeguimiento = await client.query(
      `SELECT id FROM follow_up_prospects WHERE client_id = $1 AND is_active = true`,
      [clienteId]
    );
    
    if (existeSeguimiento.rows.length === 0) {
      await client.query(`
        INSERT INTO follow_up_prospects (
          company_name,
          client_id,
          fijo_new,
          is_active
        ) VALUES ($1, $2, 1, true)
      `, [clienteResult.rows[0].name, clienteId]);
      console.log('✓ Agregado a Seguimiento');
    } else {
      console.log('✓ Ya está en Seguimiento');
    }

    // 4. Resumen final
    console.log('\n=== VERIFICACIÓN FINAL ===');
    const resumen = await client.query(`
      SELECT 
        c.name,
        b.ban_number,
        b.account_type,
        s.phone,
        s.contract_term,
        s.contract_end_date,
        CASE WHEN fp.id IS NOT NULL THEN 'SÍ' ELSE 'NO' END as en_seguimiento
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN follow_up_prospects fp ON fp.client_id = c.id AND fp.is_active = true
      WHERE c.id = $1
    `, [clienteId]);

    const r = resumen.rows[0];
    console.log('\n📊 RESUMEN:');
    console.log('═══════════════════════════════════════');
    console.log(`Cliente:        ${r.name}`);
    console.log(`BAN:            ${r.ban_number}`);
    console.log(`Tipo:           ${r.account_type}`);
    console.log(`Suscriptor:     ${r.phone} ✓`);
    console.log(`Duración:       ${r.contract_term} meses ✓`);
    console.log(`Vence:          ${r.contract_end_date.toISOString().split('T')[0]} ✓`);
    console.log(`En Seguimiento: ${r.en_seguimiento} ✓`);
    console.log('═══════════════════════════════════════');
    
    console.log('\n✅ ¡Venta completada!');
    console.log('\nVerifica en:');
    console.log('  • /clients → Colegio Santa Gema');
    console.log('  • /seguimiento → Lista de prospectos');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

completarVentaFinal();
