import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function completarVenta() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Buscar cliente
    console.log('\n=== 1. BUSCANDO CLIENTE ===');
    const clienteResult = await client.query(
      `SELECT id, name FROM clients WHERE name ILIKE '%santa gema%' ORDER BY created_at DESC LIMIT 1`
    );
    
    const clienteId = clienteResult.rows[0].id;
    console.log(`✓ Cliente: ${clienteResult.rows[0].name}`);

    // 2. Actualizar suscriptor a 24 meses
    console.log('\n=== 2. ACTUALIZANDO DURACIÓN A 24 MESES ===');
    const vencimiento24 = new Date();
    vencimiento24.setMonth(vencimiento24.getMonth() + 24); // 24 meses
    
    const updateSub = await client.query(`
      UPDATE subscribers 
      SET 
        contract_end_date = $1,
        contract_term = 24,
        updated_at = NOW()
      WHERE ban_id IN (
        SELECT id FROM bans WHERE client_id = $2
      )
      RETURNING id, phone, contract_term, contract_end_date
    `, [vencimiento24, clienteId]);
    
    console.log(`✓ Suscriptor actualizado a 24 meses`);
    console.log(`  Teléfono: ${updateSub.rows[0].phone}`);
    console.log(`  Término: ${updateSub.rows[0].contract_term} meses`);
    console.log(`  Vence: ${updateSub.rows[0].contract_end_date.toISOString().split('T')[0]}`);

    // 3. Agregar a Seguimiento
    console.log('\n=== 3. AGREGANDO A SEGUIMIENTO ===');
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
          is_active,
          created_at
        ) VALUES ($1, $2, 1, true, NOW())
        RETURNING id
      `, [clienteResult.rows[0].name, clienteId]);
      console.log('✓ Agregado a Seguimiento (fijo_new = 1)');
    } else {
      console.log('✓ Ya está en Seguimiento');
    }

    // 4. Crear reporte de venta
    console.log('\n=== 4. CREANDO REPORTE DE VENTA ===');
    
    // Obtener follow_up_prospect_id
    const followUpResult = await client.query(`
      SELECT id FROM follow_up_prospects 
      WHERE client_id = $1 AND is_active = true
      LIMIT 1
    `, [clienteId]);
    
    if (followUpResult.rows.length === 0) {
      console.log('⚠️  No se encontró follow_up_prospect - saltando reporte');
    } else {
      const followUpId = followUpResult.rows[0].id;
      
      // Verificar si ya existe reporte
      const existeReporte = await client.query(
        `SELECT id FROM sales_reports WHERE follow_up_prospect_id = $1`,
        [followUpId]
      );
      
      if (existeReporte.rows.length === 0) {
        // Obtener vendor_id
        const vendorResult = await client.query(
          `SELECT id FROM vendors LIMIT 1`
        );
        
        const vendorId = vendorResult.rows.length > 0 ? vendorResult.rows[0].id : null;
        
        // Producto Fijo New tiene comisión 330%
        const comisionFijoNew = 330.00;
        
        await client.query(`
          INSERT INTO sales_reports (
            follow_up_prospect_id,
            vendor_id,
            company_name,
            total_amount,
            sale_date,
            created_at
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, [followUpId, vendorId, clienteResult.rows[0].name, comisionFijoNew]);
        
        console.log('✓ Reporte creado en Reportes');
        console.log(`  Empresa: ${clienteResult.rows[0].name}`);
        console.log(`  Monto: $${comisionFijoNew} (Fijo New)`);
      } else {
        console.log('✓ Reporte ya existe');
      }
    }

    await client.query('COMMIT');

    // 5. Resumen final
    console.log('\n=== 5. RESUMEN FINAL ===');
    const resumen = await client.query(`
      SELECT 
        c.name as cliente,
        b.ban_number,
        b.account_type,
        s.phone as suscriptor,
        s.contract_term as meses,
        s.contract_end_date as vencimiento,
        CASE WHEN fp.id IS NOT NULL THEN 'SÍ' ELSE 'NO' END as en_seguimiento,
        COUNT(DISTINCT sr.id) as reportes
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN follow_up_prospects fp ON fp.client_id = c.id AND fp.is_active = true
      LEFT JOIN sales_reports sr ON sr.client_id = c.id
      WHERE c.id = $1
      GROUP BY c.name, b.ban_number, b.account_type, s.phone, s.contract_term, s.contract_end_date, fp.id
    `, [clienteId]);

    const r = resumen.rows[0];
    console.log('\n📊 ESTADO FINAL:');
    console.log('─────────────────────────────────────');
    console.log(`Cliente:       ${r.cliente}`);
    console.log(`BAN:           ${r.ban_number}`);
    console.log(`Tipo BAN:      ${r.account_type || 'Convergente'}`);
    console.log(`Suscriptor:    ${r.suscriptor}`);
    console.log(`Duración:      ${r.meses} meses ✓`);
    console.log(`Vencimiento:   ${r.vencimiento ? r.vencimiento.toISOString().split('T')[0] : 'Sin fecha'}`);
    console.log(`En Seguimiento: ${r.en_seguimiento} ✓`);
    console.log(`Reportes:      ${r.reportes} ✓`);
    console.log('─────────────────────────────────────');
    
    console.log('\n✅ Venta completada correctamente!');
    console.log('\nAhora verifica:');
    console.log('  • /clients → Colegio Santa Gema (duración 24 meses)');
    console.log('  • /seguimiento → Aparece en la lista');
    console.log('  • /reportes → Aparece con comisión Fijo New');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

completarVenta();
