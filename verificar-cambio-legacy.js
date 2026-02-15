import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '167.99.12.125',
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr',
  port: 5432
});

async function verificarLegacy() {
  try {
    console.log('\n=== VERIFICANDO VENTA EN LEGACY ===\n');
    
    const venta = await legacyPool.query(`
      SELECT v.vendedorid, vend.nombre as vendedor_nombre
      FROM venta v
      JOIN vendedor vend ON v.vendedorid = vend.vendedorid
      WHERE v.ban = '719400825'
      LIMIT 1
    `);
    
    if (venta.rows.length > 0) {
      console.log('BAN 719400825 en legacy:');
      console.log(`  Vendedor ID: ${venta.rows[0].vendedorid}`);
      console.log(`  Vendedor Nombre: ${venta.rows[0].vendedor_nombre}`);
    } else {
      console.log('❌ No encontrado');
    }
    
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('⚠️  IMPORTANTE:');
    console.log('════════════════════════════════════════════════════════════');
    console.log('El legacy (167.99.12.125) es solo para LEER datos históricos');
    console.log('Los cambios deben hacerse en el CRM (143.244.191.139)');
    console.log('\nPara cambiar vendedor en CRM:');
    console.log('  1. Ir al cliente en el frontend');
    console.log('  2. Editar y seleccionar vendedor correcto');
    console.log('  3. Guardar cambios');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

verificarLegacy();
