import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '167.99.12.125',
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr',
  port: 5432
});

async function buscarBAN849() {
  try {
    console.log('\n=== BUSCANDO BAN 849361537 EN VENTA ===\n');
    
    const venta = await legacyPool.query(`
      SELECT ventaid, ban, numerocelularactivado, codigovoz, meses, fechaactivacion,
             comisionclaro, comisionvendedor, comisionextra, vendedorid, clientecreditoid,
             features, bonoportabilidad, bonoretencion, bonovolumen, subsidio,
             activo, adicional, renovacion, fijo
      FROM venta 
      WHERE ban = '849361537'
    `);
    
    if (venta.rows.length > 0) {
      console.log(`✓ ${venta.rows.length} resultado(s) encontrado(s):\n`);
      
      venta.rows.forEach((v, i) => {
        console.log(`[${i+1}] Venta ID: ${v.ventaid}`);
        console.log(`    BAN: ${v.ban}`);
        console.log(`    Teléfono: ${v.numerocelularactivado || 'N/A'}`);
        console.log(`    Código Voz: ${v.codigovoz || 'N/A'}`);
        console.log(`    Meses: ${v.meses || 'N/A'}`);
        console.log(`    Fecha Activación: ${v.fechaactivacion || 'N/A'}`);
        console.log(`    Comisión Claro: $${v.comisionclaro || '0'}`);
        console.log(`    Comisión Vendedor: $${v.comisionvendedor || '0'}`);
        console.log(`    Comisión Extra: $${v.comisionextra || '0'}`);
        console.log(`    Features: $${v.features || '0'}`);
        console.log(`    Bono Portabilidad: $${v.bonoportabilidad || '0'}`);
        console.log(`    Bono Retención: $${v.bonoretencion || '0'}`);
        console.log(`    Bono Volumen: $${v.bonovolumen || '0'}`);
        console.log(`    Subsidio: $${v.subsidio || '0'}`);
        console.log(`    Vendedor ID: ${v.vendedorid || 'N/A'}`);
        console.log(`    Cliente ID: ${v.clientecreditoid || 'N/A'}`);
        console.log(`    Activo: ${v.activo ? 'Sí' : 'No'}`);
        console.log(`    Adicional: ${v.adicional ? 'Sí' : 'No'}`);
        console.log(`    Renovación: ${v.renovacion ? 'Sí' : 'No'}`);
        console.log(`    Fijo: ${v.fijo ? 'Sí' : 'No'}`);
        console.log('');
      });
      
    } else {
      console.log('❌ BAN NO encontrado');
      
      // Buscar similar
      console.log('\nBuscando BANs similares...\n');
      const similar = await legacyPool.query(`
        SELECT ban FROM venta 
        WHERE ban LIKE '849361%' 
        LIMIT 10
      `);
      
      if (similar.rows.length > 0) {
        console.log('BANs que empiezan con 849361:');
        similar.rows.forEach(r => console.log(`  • ${r.ban}`));
      }
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

buscarBAN849();
