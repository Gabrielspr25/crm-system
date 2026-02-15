import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

console.log('🔍 VERIFICACIÓN: Filtrado de BANs por Tab\n');
console.log('='.repeat(80));

try {
  // 1. Cliente con TODOS los BANs cancelados (debería aparecer SOLO en tab Cancelados)
  const allCancelledQuery = `
    WITH client_ban_status AS (
      SELECT 
        c.id, 
        c.name,
        COUNT(b.id) as total_bans,
        COUNT(CASE WHEN b.status = 'A' OR LOWER(b.status) = 'activo' THEN 1 END) as bans_activos,
        COUNT(CASE WHEN b.status = 'C' OR LOWER(b.status) = 'cancelado' OR LOWER(b.status) = 'inactivo' THEN 1 END) as bans_cancelados
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      WHERE c.name IS NOT NULL AND c.name != ''
      GROUP BY c.id, c.name
    )
    SELECT * FROM client_ban_status
    WHERE total_bans > 0 AND bans_activos = 0 AND bans_cancelados > 0
    ORDER BY name
    LIMIT 5;
  `;
  
  const allCancelledResult = await pool.query(allCancelledQuery);
  
  console.log('\n✅ CLIENTES CON TODOS LOS BANS CANCELADOS (Solo tab "Cancelados"):');
  console.log('-'.repeat(80));
  if (allCancelledResult.rows.length > 0) {
    allCancelledResult.rows.forEach(row => {
      console.log(`  • ${row.name}`);
      console.log(`    - Total BANs: ${row.total_bans} | Activos: ${row.bans_activos} | Cancelados: ${row.bans_cancelados}`);
    });
  } else {
    console.log('  ℹ️  No se encontraron clientes con todos los BANs cancelados');
  }

  // 2. Cliente con SOLO BANs activos (debería aparecer SOLO en tab Activos)
  const allActiveQuery = `
    WITH client_ban_status AS (
      SELECT 
        c.id, 
        c.name,
        COUNT(b.id) as total_bans,
        COUNT(CASE WHEN b.status = 'A' OR LOWER(b.status) = 'activo' THEN 1 END) as bans_activos,
        COUNT(CASE WHEN b.status = 'C' OR LOWER(b.status) = 'cancelado' OR LOWER(b.status) = 'inactivo' THEN 1 END) as bans_cancelados
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      WHERE c.name IS NOT NULL AND c.name != ''
      GROUP BY c.id, c.name
    )
    SELECT * FROM client_ban_status
    WHERE total_bans > 0 AND bans_activos > 0 AND bans_cancelados = 0
    ORDER BY name
    LIMIT 5;
  `;
  
  const allActiveResult = await pool.query(allActiveQuery);
  
  console.log('\n\n✅ CLIENTES CON TODOS LOS BANS ACTIVOS (Solo tab "Activos"):');
  console.log('-'.repeat(80));
  if (allActiveResult.rows.length > 0) {
    allActiveResult.rows.forEach(row => {
      console.log(`  • ${row.name}`);
      console.log(`    - Total BANs: ${row.total_bans} | Activos: ${row.bans_activos} | Cancelados: ${row.bans_cancelados}`);
    });
  } else {
    console.log('  ℹ️  No se encontraron clientes con todos los BANs activos');
  }

  // 3. Cliente con BANs MIXTOS (activos Y cancelados - aparece en tab Activos, pero muestra diferentes BANs)
  const mixedQuery = `
    WITH client_ban_status AS (
      SELECT 
        c.id, 
        c.name,
        COUNT(b.id) as total_bans,
        COUNT(CASE WHEN b.status = 'A' OR LOWER(b.status) = 'activo' THEN 1 END) as bans_activos,
        COUNT(CASE WHEN b.status = 'C' OR LOWER(b.status) = 'cancelado' OR LOWER(b.status) = 'inactivo' THEN 1 END) as bans_cancelados
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      WHERE c.name IS NOT NULL AND c.name != ''
      GROUP BY c.id, c.name
    )
    SELECT * FROM client_ban_status
    WHERE bans_activos > 0 AND bans_cancelados > 0
    ORDER BY name
    LIMIT 5;
  `;
  
  const mixedResult = await pool.query(mixedQuery);
  
  console.log('\n\n✅ CLIENTES CON BANS MIXTOS (Aparece en tab "Activos"):');
  console.log('-'.repeat(80));
  if (mixedResult.rows.length > 0) {
    mixedResult.rows.forEach(row => {
      console.log(`  • ${row.name}`);
      console.log(`    - Total BANs: ${row.total_bans} | Activos: ${row.bans_activos} | Cancelados: ${row.bans_cancelados}`);
      console.log(`    📌 En modal desde tab "Activos": Muestra SOLO ${row.bans_activos} BAN(s) activo(s)`);
      console.log(`    📌 En modal desde tab "Cancelados": Muestra SOLO ${row.bans_cancelados} BAN(s) cancelado(s)`);
    });
  } else {
    console.log('  ℹ️  No se encontraron clientes con BANs mixtos');
  }

  // 4. Ejemplo específico: JOHANNA MOTA
  const johannaQuery = `
    SELECT 
      c.name,
      b.ban_number,
      b.status,
      CASE 
        WHEN b.status = 'A' OR LOWER(b.status) = 'activo' THEN '✅ ACTIVO'
        ELSE '❌ CANCELADO'
      END as estado_visual
    FROM clients c
    JOIN bans b ON b.client_id = c.id
    WHERE UPPER(c.name) = 'JOHANNA MOTA'
    ORDER BY b.ban_number;
  `;
  
  const johannaResult = await pool.query(johannaQuery);
  
  console.log('\n\n🔍 CASO ESPECÍFICO: JOHANNA MOTA');
  console.log('-'.repeat(80));
  if (johannaResult.rows.length > 0) {
    console.log(`  Cliente: ${johannaResult.rows[0].name}`);
    console.log(`  Total BANs: ${johannaResult.rows.length}`);
    console.log(`\n  Lista de BANs:`);
    johannaResult.rows.forEach(row => {
      console.log(`    - BAN ${row.ban_number}: ${row.estado_visual}`);
    });
    
    const activos = johannaResult.rows.filter(r => r.status === 'A' || r.status?.toLowerCase() === 'activo').length;
    const cancelados = johannaResult.rows.length - activos;
    
    console.log(`\n  📊 Resumen:`);
    console.log(`    - Activos: ${activos}`);
    console.log(`    - Cancelados: ${cancelados}`);
    console.log(`\n  📌 Comportamiento esperado:`);
    console.log(`    - Aparece en tab "Activos" (tiene ${activos} BAN activo)`);
    console.log(`    - Al abrir desde "Activos": Muestra SOLO ${activos} BAN(s) activo(s)`);
    console.log(`    - NO aparece en "Cancelados" (tiene al menos 1 BAN activo)`);
  } else {
    console.log('  ℹ️  Cliente JOHANNA MOTA no encontrado');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Verificación completada\n');

} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await pool.end();
}
