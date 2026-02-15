import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function buscarPlanRed3535() {
  try {
    console.log('\n=== BUSCANDO PLAN RED3535 ===');
    
    // Buscar plan por código
    const result = await pool.query(`
      SELECT 
        id, 
        name, 
        code, 
        alpha_code,
        price,
        category_id
      FROM plans 
      WHERE 
        code ILIKE '%3535%' 
        OR alpha_code ILIKE '%3535%' 
        OR name ILIKE '%3535%'
        OR code ILIKE '%red%'
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ Plan "red3535" NO encontrado en tabla plans');
      console.log('\n=== PLANES DISPONIBLES (muestra) ===');
      
      const allPlans = await pool.query(`
        SELECT id, name, code, alpha_code 
        FROM plans 
        ORDER BY name 
        LIMIT 10
      `);
      
      allPlans.rows.forEach(p => {
        console.log(`  ${p.name} | Código: ${p.code || 'N/A'} | Alpha: ${p.alpha_code || 'N/A'}`);
      });
      
      console.log('\n¿Dónde se gestiona?');
      console.log('  • Frontend: /tarifas');
      console.log('  • Tabla BD: plans');
      
    } else {
      console.log('✅ Plan encontrado:\n');
      result.rows.forEach(p => {
        console.log(`ID: ${p.id}`);
        console.log(`Nombre: ${p.name}`);
        console.log(`Código: ${p.code}`);
        console.log(`Alpha Code: ${p.alpha_code}`);
        console.log(`Precio: $${p.price}`);
        console.log(`Categoría ID: ${p.category_id}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

buscarPlanRed3535();
