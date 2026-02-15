import pkg from 'pg';
const { Pool } = pkg;

// Base LEGACY (159.203.70.5)
const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

async function buscarVentaLegacy() {
  try {
    console.log('\n=== BUSCANDO VENTA EN BASE LEGACY ===');
    
    // Buscar por BAN
    const result = await legacyPool.query(`
      SELECT *
      FROM venta
      WHERE ban = $1
      LIMIT 1
    `, ['719400825']);

    if (result.rows.length === 0) {
      console.log('❌ Venta NO encontrada en tabla venta');
      
      // Buscar en otras tablas posibles
      const tables = await legacyPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      console.log('\n=== TABLAS DISPONIBLES EN LEGACY ===');
      tables.rows.forEach(t => console.log(`  • ${t.table_name}`));
      
    } else {
      console.log('✅ Venta encontrada en tabla "venta":\n');
      const v = result.rows[0];
      
      console.log('DATOS DE LA VENTA:');
      console.log(`BAN: ${v.ban}`);
      console.log(`Teléfono: ${v.numerocelularactivado || v.nrocelular || 'N/A'}`);
      console.log(`Código Voz: ${v.codigovoz || 'N/A'}`);
      console.log(`Meses: ${v.meses || 'N/A'}`);
      console.log(`Soc Equipo: ${v.socequipo || 'N/A'}`);
      console.log(`Comisión: ${v.comisionarecibirclaro || 'N/A'}`);
      console.log(`Precio Financiado: ${v.preciofinanciado || 'N/A'}`);
      
      console.log('\n=== TODAS LAS COLUMNAS ===');
      console.log(JSON.stringify(v, null, 2));
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

buscarVentaLegacy();
