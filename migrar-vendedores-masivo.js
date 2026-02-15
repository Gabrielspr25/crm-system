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

// Mapeo manual de vendedores legacy → CRM
const VENDOR_MAP = {
  32: '181a77b4-583c-4455-8e83-3147f540db68',   // Gabriel Sanchez
  67: 'dcc8bbc7-d322-4190-bae0-3006d894a98e',   // HERNAN
  297: '4a251dbc-ff8d-4bdb-9216-1517ece4f295',  // maira (Mayda Salas)
  218: 'bc42c470-c582-4fe7-ab36-ac0f82e239f1',  // ANEUDY (Rocio)
  66: '181a77b4-583c-4455-8e83-3147f540db68',   // Gabriel (mismo que Gabriel Sanchez)
  293: '4a251dbc-ff8d-4bdb-9216-1517ece4f295',  // maira (Maira Dorado)
  299: 'b7ce39fc-d2ab-4e63-b580-398742a8fe08',  // YARITZA
  274: 'fff370d3-cbd7-4fa4-8651-8dfdd18fff13',  // RANDY
  298: 'c57f897e-5259-4c4e-b8cc-6b19f36c5ed0'   // DAYANA
};

async function migrarVendedores() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     MIGRACIÓN MASIVA: VENDEDORES LEGACY → CRM             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Obtener todos los clientes del CRM con sus BANs
    console.log('1️⃣  Obteniendo clientes del CRM...\n');
    
    const clientes = await currentPool.query(`
      SELECT DISTINCT
        c.id as client_id,
        c.name as client_name,
        c.salesperson_id,
        b.ban_number
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      WHERE c.salesperson_id IS NOT NULL
      ORDER BY c.name
    `);
    
    console.log(`   ✓ ${clientes.rows.length} clientes encontrados\n`);
    
    let actualizados = 0;
    let sinVendedorLegacy = 0;
    let sinMapeo = 0;
    let yaCorrectos = 0;
    
    console.log('2️⃣  Procesando clientes...\n');
    
    for (const cliente of clientes.rows) {
      // Buscar vendedor en legacy por BAN
      const ventaLegacy = await legacyPool.query(`
        SELECT vendedorid, ban
        FROM venta
        WHERE ban = $1
        LIMIT 1
      `, [cliente.ban_number]);
      
      if (ventaLegacy.rows.length === 0) {
        sinVendedorLegacy++;
        continue;
      }
      
      const vendedorLegacyId = ventaLegacy.rows[0].vendedorid;
      const vendedorCrmUuid = VENDOR_MAP[vendedorLegacyId];
      
      if (!vendedorCrmUuid) {
        console.log(`   ⚠️  ${cliente.client_name}: Vendedor legacy ${vendedorLegacyId} sin mapeo`);
        sinMapeo++;
        continue;
      }
      
      // Verificar si ya tiene el vendedor correcto
      if (cliente.salesperson_id === vendedorCrmUuid) {
        yaCorrectos++;
        continue;
      }
      
      // Actualizar vendedor
      await currentPool.query(`
        UPDATE clients
        SET salesperson_id = $1
        WHERE id = $2
      `, [vendedorCrmUuid, cliente.client_id]);
      
      console.log(`   ✓ ${cliente.client_name}: vendedor actualizado`);
      actualizados++;
    }
    
    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('RESUMEN:');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`Total clientes procesados: ${clientes.rows.length}`);
    console.log(`✅ Actualizados: ${actualizados}`);
    console.log(`✓ Ya correctos: ${yaCorrectos}`);
    console.log(`⚠️  Sin venta en legacy: ${sinVendedorLegacy}`);
    console.log(`⚠️  Sin mapeo de vendedor: ${sinMapeo}`);
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

migrarVendedores();
