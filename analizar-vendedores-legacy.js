import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '167.99.12.125',
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr',
  port: 5432
});

const currentPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function analizarVendedores() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          ANÁLISIS VENDEDORES LEGACY → CRM                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Vendedores en legacy que tienen ventas
    console.log('1️⃣  VENDEDORES EN LEGACY (con ventas):');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const vendedoresLegacy = await legacyPool.query(`
      SELECT v.vendedorid, v.nombre, COUNT(vt.ventaid) as total_ventas
      FROM vendedor v
      LEFT JOIN venta vt ON vt.vendedorid = v.vendedorid
      WHERE v.activo = true
      GROUP BY v.vendedorid, v.nombre
      HAVING COUNT(vt.ventaid) > 0
      ORDER BY total_ventas DESC
      LIMIT 20
    `);
    
    vendedoresLegacy.rows.forEach((v, i) => {
      console.log(`   [${i+1}] ID: ${v.vendedorid} | ${v.nombre} | Ventas: ${v.total_ventas}`);
    });
    
    // Salespeople en CRM actual
    console.log('\n\n2️⃣  SALESPEOPLE EN CRM ACTUAL:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const salespeople = await currentPool.query(`
      SELECT id, name, email FROM salespeople ORDER BY name
    `);
    
    salespeople.rows.forEach((s, i) => {
      console.log(`   [${i+1}] ${s.name} | ${s.email || 'Sin email'}`);
      console.log(`       UUID: ${s.id}`);
    });
    
    // Buscar vendedor específico de Colegio Santa Gema
    console.log('\n\n3️⃣  VENDEDOR DE COLEGIO SANTA GEMA EN LEGACY:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const santaGemaVenta = await legacyPool.query(`
      SELECT v.vendedorid, vend.nombre
      FROM venta v
      JOIN vendedor vend ON v.vendedorid = vend.vendedorid
      WHERE v.ban = '719400825'
      LIMIT 1
    `);
    
    if (santaGemaVenta.rows.length > 0) {
      const vend = santaGemaVenta.rows[0];
      console.log(`   BAN 719400825 fue vendido por:`);
      console.log(`   ID: ${vend.vendedorid} | ${vend.nombre}`);
    } else {
      console.log('   ❌ No encontrado en tabla venta');
    }
    
    console.log('\n\n════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

analizarVendedores();
