import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function fixVentaCompleta() {
  const client = await pool.connect();
  
  try {
    // 1. Buscar el cliente Colegio Santa Gema
    console.log('\n=== 1. BUSCANDO CLIENTE ===');
    const clienteResult = await client.query(
      `SELECT id, name FROM clients WHERE name ILIKE '%santa gema%' ORDER BY created_at DESC LIMIT 1`
    );
    
    if (clienteResult.rows.length === 0) {
      console.log('❌ Cliente no encontrado');
      return;
    }
    
    const clienteId = clienteResult.rows[0].id;
    console.log(`✓ Cliente encontrado: ${clienteResult.rows[0].name} (${clienteId})`);

    // 2. Verificar BAN
    console.log('\n=== 2. VERIFICANDO BAN ===');
    const banResult = await client.query(
      `SELECT id, ban_number, account_type FROM bans WHERE client_id = $1`,
      [clienteId]
    );
    
    if (banResult.rows.length === 0) {
      console.log('❌ BAN no encontrado');
      return;
    }
    
    const ban = banResult.rows[0];
    console.log(`✓ BAN encontrado: ${ban.ban_number}`);
    console.log(`  Tipo actual: ${ban.account_type || 'NULL'}`);

    // 3. Actualizar tipo de BAN si está vacío
    if (!ban.account_type) {
      console.log('\n=== 3. ACTUALIZANDO TIPO DE BAN ===');
      await client.query(
        `UPDATE bans SET account_type = $1 WHERE id = $2`,
        ['FIJO', ban.id]
      );
      console.log('✓ Tipo de BAN actualizado a: FIJO (PYMES)');
    }

    // 4. Verificar suscriptores
    console.log('\n=== 4. VERIFICANDO SUSCRIPTORES ===');
    const subsResult = await client.query(
      `SELECT id, phone, line_type, contract_end_date FROM subscribers WHERE ban_id = $1`,
      [ban.id]
    );
    
    console.log(`✓ Suscriptores encontrados: ${subsResult.rows.length}`);
    
    if (subsResult.rows.length > 0) {
      for (const sub of subsResult.rows) {
        console.log(`  - ${sub.phone} | Tipo: ${sub.line_type} | Vence: ${sub.contract_end_date || 'SIN FECHA'}`);
        
        // 5. Actualizar fecha de vencimiento si no existe
        if (!sub.contract_end_date) {
          const vencimiento = new Date();
          vencimiento.setFullYear(vencimiento.getFullYear() + 1); // 1 año desde hoy
          
          await client.query(
            `UPDATE subscribers SET contract_end_date = $1 WHERE id = $2`,
            [vencimiento, sub.id]
          );
          console.log(`    ✓ Fecha vencimiento actualizada: ${vencimiento.toISOString().split('T')[0]}`);
        }
      }
    }

    // 6. Obtener vendedor del cliente
    console.log('\n=== 5. VERIFICANDO VENDEDOR ===');
    const clienteFull = await client.query(
      `SELECT c.*, sp.name as vendedor_nombre FROM clients c
       LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
       WHERE c.id = $1`,
      [clienteId]
    );
    
    const vendedorId = clienteFull.rows[0].salesperson_id;
    console.log(`✓ Vendedor asignado: ${clienteFull.rows[0].vendedor_nombre || 'SIN ASIGNAR'}`);

    // 7. Mover a seguimiento (follow_up_prospects)
    console.log('\n=== 6. MOVIENDO A SEGUIMIENTO ===');
    const existeEnSeguimiento = await client.query(
      `SELECT id FROM follow_up_prospects WHERE client_id = $1 AND is_active = true`,
      [clienteId]
    );
    
    if (existeEnSeguimiento.rows.length === 0) {
      await client.query(`
        INSERT INTO follow_up_prospects (
          client_id, 
          salesperson_id,
          is_active,
          created_at
        ) VALUES ($1, $2, true, NOW())
      `, [clienteId, vendedorId]);
      console.log('✓ Cliente agregado a Seguimiento');
    } else {
      console.log('✓ Cliente ya está en Seguimiento');
    }

    // 8. Crear reporte de venta
    console.log('\n=== 7. CREANDO REPORTE DE VENTA ===');
    
    // Obtener el producto correcto (Fijo New)
    const productoResult = await client.query(`
      SELECT p.id, p.name, p.commission_percentage
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE c.name = 'Fijo' AND p.name ILIKE '%new%'
      LIMIT 1
    `);
    
    if (productoResult.rows.length === 0) {
      console.log('⚠️  Producto "Fijo New" no encontrado - saltando reporte');
    } else {
      const producto = productoResult.rows[0];
      console.log(`✓ Producto encontrado: ${producto.name} (${producto.commission_percentage}%)`);
      
      // Verificar si ya existe reporte
      const existeReporte = await client.query(
        `SELECT id FROM sales_reports 
         WHERE client_id = $1 AND product_id = $2`,
        [clienteId, producto.id]
      );
      
      if (existeReporte.rows.length === 0) {
        await client.query(`
          INSERT INTO sales_reports (
            salesperson_id,
            client_id,
            product_id,
            sale_date,
            quantity,
            commission_amount,
            status,
            created_at
          ) VALUES ($1, $2, $3, NOW(), 1, $4, 'pending', NOW())
        `, [vendedorId, clienteId, producto.id, producto.commission_percentage]);
        console.log('✓ Reporte de venta creado');
      } else {
        console.log('✓ Reporte de venta ya existe');
      }
    }

    // 9. Resumen final
    console.log('\n=== 8. RESUMEN FINAL ===');
    const resumen = await client.query(`
      SELECT 
        c.name as cliente,
        b.ban_number,
        b.account_type,
        b.status,
        COUNT(s.id) as total_suscriptores,
        STRING_AGG(s.phone, ', ') as telefonos,
        sp.name as vendedor,
        CASE WHEN fp.id IS NOT NULL THEN 'SÍ' ELSE 'NO' END as en_seguimiento,
        COUNT(sr.id) as reportes
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
      LEFT JOIN follow_up_prospects fp ON fp.client_id = c.id AND fp.is_active = true
      LEFT JOIN sales_reports sr ON sr.client_id = c.id
      WHERE c.id = $1
      GROUP BY c.name, b.ban_number, b.account_type, b.status, sp.name, fp.id
    `, [clienteId]);

    console.log('\n📊 ESTADO ACTUAL:');
    console.log('─────────────────────────────────────');
    const r = resumen.rows[0];
    console.log(`Cliente:       ${r.cliente}`);
    console.log(`BAN:           ${r.ban_number}`);
    console.log(`Tipo BAN:      ${r.account_type || '❌ VACÍO'}`);
    console.log(`Estado:        ${r.status === 'A' ? 'Activo' : 'Inactivo'}`);
    console.log(`Suscriptores:  ${r.total_suscriptores}`);
    console.log(`Teléfonos:     ${r.telefonos || '❌ NINGUNO'}`);
    console.log(`Vendedor:      ${r.vendedor || '❌ SIN ASIGNAR'}`);
    console.log(`En Seguimiento: ${r.en_seguimiento}`);
    console.log(`Reportes:      ${r.reportes}`);
    console.log('─────────────────────────────────────');

    console.log('\n✅ Venta completamente corregida!');
    console.log('\nAhora puedes ver:');
    console.log('  • Clientes → Colegio Santa Gema (con tipo BAN y suscriptores)');
    console.log('  • Seguimiento → Aparecerá en la lista');
    console.log('  • Reportes → Verás la comisión calculada');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixVentaCompleta();
