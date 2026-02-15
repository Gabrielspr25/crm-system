const { Pool } = require('pg');

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

async function mapVendors() {
  try {
    // Get all salespeople
    const salespeople = await pool.query('SELECT id, name FROM salespeople ORDER BY name');
    console.log('=== SALESPEOPLE (UUID) ===');
    salespeople.rows.forEach(sp => {
      console.log(`${sp.id} -> ${sp.name}`);
    });
    
    // Get all vendors
    const vendors = await pool.query('SELECT id, name FROM vendors ORDER BY name');
    console.log('\n=== VENDORS (INTEGER) ===');
    vendors.rows.forEach(v => {
      console.log(`${v.id} -> ${v.name}`);
    });
    
    // Try to find Gabriel Sanchez in vendors
    console.log('\n=== BÚSQUEDA DE GABRIEL ===');
    const gabriel = vendors.rows.find(v => 
      v.name.toUpperCase().includes('GABRIEL')
    );
    
    if (gabriel) {
      console.log(`✅ Encontrado vendor ID ${gabriel.id}: ${gabriel.name}`);
      
      // Update prospect vendor_id
      console.log('\nActualizando prospecto...');
      await pool.query(`
        UPDATE follow_up_prospects 
        SET vendor_id = $1 
        WHERE id = 83
      `, [gabriel.id]);
      
      console.log('✅ Prospecto actualizado con vendor_id =', gabriel.id);
    } else {
      console.log('❌ No se encontró vendor Gabriel');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

mapVendors();
