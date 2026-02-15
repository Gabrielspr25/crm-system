import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

async function buscarTipoPlan() {
  try {
    console.log('\n=== BUSCANDO TABLA tipoplan ===\n');
    
    // Verificar si existe
    const existe = await legacyPool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tipoplan'
      )
    `);
    
    if (!existe.rows[0].exists) {
      console.log('❌ Tabla "tipoplan" NO existe\n');
      
      // Buscar tablas similares
      console.log('Buscando tablas con "plan" en el nombre:\n');
      const tablas = await legacyPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE '%plan%'
        ORDER BY table_name
      `);
      
      tablas.rows.forEach(t => console.log(`  • ${t.table_name}`));
      return;
    }
    
    console.log('✓ Tabla tipoplan encontrada\n');
    
    // Ver estructura
    console.log('ESTRUCTURA:\n');
    const cols = await legacyPool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'tipoplan'
      ORDER BY ordinal_position
    `);
    
    cols.rows.forEach(c => {
      console.log(`  ${c.column_name} (${c.data_type})`);
    });
    
    // Buscar VREDPLU3
    console.log('\n\nBUSCANDO codigovoz = "VREDPLU3":\n');
    const plan = await legacyPool.query(`
      SELECT * FROM tipoplan WHERE codigovoz = 'VREDPLU3'
    `);
    
    if (plan.rows.length > 0) {
      console.log('✓ ENCONTRADO:');
      const p = plan.rows[0];
      Object.keys(p).forEach(key => {
        console.log(`  ${key}: ${p[key]}`);
      });
    } else {
      console.log('❌ No encontrado con ese código');
      
      // Mostrar algunos registros
      console.log('\nMuestra de registros en tipoplan:\n');
      const muestra = await legacyPool.query(`
        SELECT * FROM tipoplan LIMIT 5
      `);
      
      muestra.rows.forEach((r, i) => {
        console.log(`[${i+1}] codigovoz: ${r.codigovoz} | rate: ${r.rate || 'N/A'}`);
      });
    }
    
    // Buscar BAN de la imagen: 849361537
    console.log('\n\n=== BUSCANDO BAN 849361537 EN VENTA ===\n');
    const venta = await legacyPool.query(`
      SELECT ventaid, ban, numerocelularactivado, codigovoz, meses,
             comisionclaro, comisionvendedor, fechaactivacion, vendedorid
      FROM venta 
      WHERE ban = '849361537'
    `);
    
    if (venta.rows.length > 0) {
      console.log('✓ VENTA ENCONTRADA:');
      const v = venta.rows[0];
      console.log(`  Venta ID: ${v.ventaid}`);
      console.log(`  BAN: ${v.ban}`);
      console.log(`  Teléfono: ${v.numerocelularactivado || 'N/A'}`);
      console.log(`  Código Voz: ${v.codigovoz || 'N/A'}`);
      console.log(`  Meses: ${v.meses || 'N/A'}`);
      console.log(`  Comisión Claro: $${v.comisionclaro || '0'}`);
      console.log(`  Comisión Vendedor: $${v.comisionvendedor || '0'}`);
      console.log(`  Fecha Act: ${v.fechaactivacion || 'N/A'}`);
      console.log(`  Vendedor ID: ${v.vendedorid || 'N/A'}`);
    } else {
      console.log('❌ BAN NO encontrado en venta');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
  }
}

buscarTipoPlan();
