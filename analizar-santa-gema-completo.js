import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
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

async function analizarSantaGema() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║             ANÁLISIS: COLEGIO SANTA GEMA                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('DATOS EN CRM ACTUAL:');
    console.log('  BAN: 719400825');
    console.log('  Teléfono: 939-777-0017');
    console.log('  Valor mensual: $35.00');
    console.log('  Follow-up: NO completado ❌');
    console.log('  Reportes: 0 ❌\n');
    
    // Buscar en legacy por BAN
    console.log('BUSCANDO EN LEGACY (por BAN):\n');
    
    const ventaBan = await legacyPool.query(`
      SELECT * FROM venta WHERE ban = '719400825' LIMIT 1
    `);
    
    if (ventaBan.rows.length > 0) {
      const v = ventaBan.rows[0];
      console.log('✓ VENTA ENCONTRADA EN LEGACY:');
      console.log(`  Venta ID: ${v.ventaid}`);
      console.log(`  BAN: ${v.ban}`);
      console.log(`  Teléfono: ${v.numerocelularactivado || 'N/A'}`);
      console.log(`  Código Voz: ${v.codigovoz || 'N/A'}`);
      console.log(`  Meses: ${v.meses || 'N/A'}`);
      console.log(`  Comisión Claro: $${v.comisionclaro || '0'}`);
      console.log(`  Comisión Vendedor: $${v.comisionvendedor || '0'}`);
      console.log(`  Comisión Extra: $${v.comisionextra || '0'}`);
      console.log(`  Fecha Activación: ${v.fechaactivacion || 'N/A'}`);
      console.log(`  Vendedor ID: ${v.vendedorid || 'N/A'}`);
      console.log(`  Cliente ID: ${v.clientecreditoid || 'N/A'}`);
      
      // Buscar el cliente en legacy
      if (v.clientecreditoid) {
        const cliente = await legacyPool.query(`
          SELECT * FROM clientecredito WHERE clientecreditoid = $1
        `, [v.clientecreditoid]);
        
        if (cliente.rows.length > 0) {
          const c = cliente.rows[0];
          console.log(`\n  Cliente Legacy:`);
          console.log(`    ID: ${c.clientecreditoid}`);
          console.log(`    Nombre: ${c.nombre || 'N/A'}`);
          console.log(`    Apellido: ${c.apellido || 'N/A'}`);
          console.log(`    PYME: ${c.pyme ? 'Sí' : 'No'}`);
        }
      }
      
      console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('PARA COMPLETAR LA VENTA EN REPORTES, NECESITAS:\n');
      console.log('1. Marcar follow_up_prospect como completado:');
      console.log('   UPDATE follow_up_prospects');
      console.log('   SET completed_date = NOW()');
      console.log(`   WHERE id = 83;\n`);
      
      console.log('2. El sistema auto-generará el reporte con estos datos:');
      console.log(`   • Subscriber ID: (del suscriptor)`);
      console.log(`   • Valor mensual: $35.00`);
      console.log(`   • Comisión Claro (company_earnings): $${v.comisionclaro || '0'}`);
      console.log(`   • Comisión Vendedor (vendor_commission): $${v.comisionvendedor || '0'}`);
      console.log(`   • Fecha: ${v.fechaactivacion || 'AHORA'}`);
      
    } else {
      console.log('❌ BAN NO encontrado en tabla venta del legacy');
      console.log('\nBuscando por teléfono...\n');
      
      const ventaTel = await legacyPool.query(`
        SELECT * FROM venta 
        WHERE numerocelularactivado LIKE '%939-777-0017%'
           OR numerocelularactivado LIKE '%9397770017%'
        LIMIT 5
      `);
      
      if (ventaTel.rows.length > 0) {
        console.log(`✓ ${ventaTel.rows.length} resultado(s) por teléfono:`);
        ventaTel.rows.forEach((v, i) => {
          console.log(`\n[${i+1}] BAN: ${v.ban} | Tel: ${v.numerocelularactivado}`);
        });
      } else {
        console.log('❌ Tampoco encontrado por teléfono');
        console.log('\nEste cliente fue creado DIRECTAMENTE en el CRM (no viene del legacy)');
        console.log('\nPARA COMPLETAR LA VENTA:');
        console.log('1. Marca follow_up como completado');
        console.log('2. Manualmente edita valores en Reportes si necesitas comisiones específicas');
      }
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

analizarSantaGema();
