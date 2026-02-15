import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function crearReporte() {
  try {
    console.log('\n=== CREANDO REPORTE DE VENTA ===\n');
    
    // Obtener vendor_id (usar el primero disponible)
    const vendor = await pool.query(`SELECT id, name FROM vendors LIMIT 1`);
    
    if (vendor.rows.length === 0) {
      console.log('❌ No hay vendors en la tabla');
      return;
    }
    
    const vendorId = vendor.rows[0].id;
    console.log(`✓ Vendor ID: ${vendorId} (${vendor.rows[0].name})`);
    
    // Crear reporte
    // Fijo New comisión = 330% según products table
    const comision = 330.00;
    
    const result = await pool.query(`
      INSERT INTO sales_reports (
        follow_up_prospect_id,
        client_id,
        vendor_id,
        company_name,
        total_amount,
        sale_date,
        created_at
      ) 
      SELECT 
        fp.id,
        83, -- client_id temporal (ID legacy, no existe relación real)
        $1,
        fp.company_name,
        $2,
        NOW(),
        NOW()
      FROM follow_up_prospects fp
      JOIN clients c ON c.id = fp.client_id
      WHERE c.name ILIKE '%santa gema%' AND fp.is_active = true
      LIMIT 1
      RETURNING id, company_name, total_amount, sale_date
    `, [vendorId, comision]);
    
    if (result.rows.length > 0) {
      const r = result.rows[0];
      console.log('\n✅ REPORTE CREADO:');
      console.log('═══════════════════════════════════════');
      console.log(`ID:       ${r.id}`);
      console.log(`Empresa:  ${r.company_name}`);
      console.log(`Comisión: $${r.total_amount} (Fijo New 330%)`);
      console.log(`Fecha:    ${r.sale_date.toISOString().split('T')[0]}`);
      console.log('═══════════════════════════════════════');
      console.log('\n✅ Ahora aparecerá en /reportes');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Detalles:', error);
  } finally {
    await pool.end();
  }
}

crearReporte();
