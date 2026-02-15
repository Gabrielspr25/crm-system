import pkg from 'pg';
const { Pool } = pkg;

const currentPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function revisarVendedor() {
  try {
    console.log('\n=== REVISANDO VENDEDOR COLEGIO SANTA GEMA ===\n');
    
    const cliente = await currentPool.query(`
      SELECT 
        c.id,
        c.name,
        c.salesperson_id,
        sp.name as salesperson_name,
        sp.email
      FROM clients c
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      WHERE LOWER(c.name) LIKE '%santa gema%'
    `);
    
    if (cliente.rows.length === 0) {
      console.log('❌ Cliente no encontrado\n');
      return;
    }
    
    const c = cliente.rows[0];
    
    console.log('CLIENTE EN CRM:');
    console.log(`  Nombre: ${c.name}`);
    console.log(`  Salesperson ID: ${c.salesperson_id || 'NULL'}`);
    console.log(`  Salesperson Nombre: ${c.salesperson_name || 'N/A'}`);
    console.log(`  Salesperson Email: ${c.email || 'N/A'}`);
    
    console.log('\n\nVENDEDOR CORRECTO (del legacy):');
    console.log('  ID legacy: 293');
    console.log('  Nombre: Maira Dorado');
    
    console.log('\n\nVENDEDORES MAIRA EN CRM:');
    const mairas = await currentPool.query(`
      SELECT id, name, email 
      FROM salespeople 
      WHERE LOWER(name) LIKE '%maira%'
    `);
    
    mairas.rows.forEach(m => {
      console.log(`  • ${m.name} | ${m.email || 'Sin email'} | UUID: ${m.id}`);
    });
    
    console.log('\n════════════════════════════════════════════════════════════\n');
    
    if (c.salesperson_id && c.salesperson_name !== 'Maira Dorado') {
      console.log('⚠️  PROBLEMA: Vendedor asignado es incorrecto');
      console.log(`   Actual: ${c.salesperson_name}`);
      console.log(`   Debería ser: Maira Dorado`);
    } else if (!c.salesperson_id) {
      console.log('⚠️  PROBLEMA: No tiene vendedor asignado');
    } else {
      console.log('✅ Vendedor correcto asignado');
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await currentPool.end();
  }
}

revisarVendedor();
