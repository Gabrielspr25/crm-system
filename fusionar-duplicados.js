const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function fusionarDuplicados() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Buscando clientes duplicados por business_name...\n');
    
    // Encontrar todos los business_name que tienen duplicados
    const duplicatesQuery = `
      SELECT business_name, COUNT(*) as count, STRING_AGG(id::text, ', ' ORDER BY id) as ids
      FROM clients
      WHERE business_name IS NOT NULL
      GROUP BY business_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC, business_name
    `;
    
    const duplicates = await client.query(duplicatesQuery);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No se encontraron clientes duplicados. Todo está bien!');
      return;
    }
    
    console.log(`⚠️  Encontrados ${duplicates.rows.length} grupos de clientes duplicados:\n`);
    
    let totalFusionados = 0;
    
    for (const dup of duplicates.rows) {
      const businessName = dup.business_name;
      const count = parseInt(dup.count);
      const ids = dup.ids.split(', ').map(id => parseInt(id));
      
      console.log(`📋 "${businessName}" - ${count} duplicados (IDs: ${ids.join(', ')})`);
      
      // Usar el cliente más antiguo (ID menor) como principal
      const clientIdPrincipal = Math.min(...ids);
      const duplicadosAFusionar = ids.filter(id => id !== clientIdPrincipal);
      
      await client.query('BEGIN');
      
      try {
        for (const dupId of duplicadosAFusionar) {
          // 1. Mover todos los BANs del duplicado al cliente principal
          const bansMovidos = await client.query(
            `UPDATE bans SET client_id = $1, updated_at = NOW() WHERE client_id = $2 RETURNING id`,
            [clientIdPrincipal, dupId]
          );
          
          // 2. Eliminar el cliente duplicado
          await client.query(
            `DELETE FROM clients WHERE id = $1`,
            [dupId]
          );
          
          console.log(`   ✅ Fusionado cliente ${dupId} → ${clientIdPrincipal} (${bansMovidos.rows.length} BANs movidos)`);
          totalFusionados++;
        }
        
        await client.query('COMMIT');
        console.log(`   ✨ Grupo "${businessName}" fusionado correctamente\n`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Error fusionando "${businessName}":`, error.message);
      }
    }
    
    console.log(`\n🎉 PROCESO COMPLETADO`);
    console.log(`   - ${duplicates.rows.length} grupos de duplicados encontrados`);
    console.log(`   - ${totalFusionados} clientes fusionados`);
    console.log(`   - Clientes únicos resultantes: ${duplicates.rows.length}`);
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
fusionarDuplicados();
