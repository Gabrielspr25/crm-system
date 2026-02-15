import pkg from 'pg';
const { Pool } = pkg;

const currentPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function asignarVendedorGabriel() {
  try {
    console.log('\n=== ASIGNANDO VENDEDOR GABRIEL A COLEGIO SANTA GEMA ===\n');
    
    // Buscar Gabriel Sanchez en salespeople
    const gabriel = await currentPool.query(`
      SELECT id, name FROM salespeople 
      WHERE LOWER(name) LIKE '%gabriel%sanchez%' 
         OR LOWER(name) = 'gabriel'
      LIMIT 1
    `);
    
    if (gabriel.rows.length === 0) {
      console.log('❌ Gabriel Sanchez no encontrado en salespeople\n');
      
      // Mostrar todos los vendedores
      const all = await currentPool.query(`SELECT id, name FROM salespeople ORDER BY name`);
      console.log('Vendedores disponibles:');
      all.rows.forEach(v => console.log(`  • ${v.name} (${v.id})`));
      return;
    }
    
    const gabrielId = gabriel.rows[0].id;
    console.log(`✓ Vendedor encontrado: ${gabriel.rows[0].name}`);
    console.log(`  UUID: ${gabrielId}\n`);
    
    // Actualizar cliente
    const result = await currentPool.query(`
      UPDATE clients 
      SET salesperson_id = $1
      WHERE LOWER(name) LIKE '%santa gema%'
      RETURNING id, name, salesperson_id
    `, [gabrielId]);
    
    if (result.rows.length > 0) {
      console.log('✅ Cliente actualizado:');
      console.log(`  Cliente: ${result.rows[0].name}`);
      console.log(`  Vendedor asignado: Gabriel Sanchez (${gabrielId})`);
    } else {
      console.log('❌ No se pudo actualizar el cliente');
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await currentPool.end();
  }
}

asignarVendedorGabriel();
