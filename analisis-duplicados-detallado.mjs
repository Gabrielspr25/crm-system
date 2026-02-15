import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function generateComparisonReport() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     ANÁLISIS COMPARATIVO DE 110 CLIENTES DUPLICADOS                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  // Buscar nombres duplicados
  const duplicates = await pool.query(`
    SELECT 
      UPPER(TRIM(name)) as nombre_normalizado,
      COUNT(*) as cantidad_duplicados,
      array_agg(id::text ORDER BY created_at) as client_ids
    FROM clients
    WHERE name IS NOT NULL AND TRIM(name) != ''
    GROUP BY UPPER(TRIM(name))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, UPPER(TRIM(name))
  `);

  console.log(`📊 Total de nombres duplicados: ${duplicates.rows.length}\n`);

  let reporte = [];

  for (let i = 0; i < duplicates.rows.length; i++) {
    const dup = duplicates.rows[i];
    
    // Obtener detalles de cada duplicado
    const details = await pool.query(`
      SELECT 
        c.id,
        c.name as nombre_original,
        c.created_at,
        c.salesperson_id,
        sp.name as salesperson_name,
        COUNT(DISTINCT b.id) as total_bans,
        array_agg(DISTINCT b.ban_number ORDER BY b.ban_number) FILTER (WHERE b.ban_number IS NOT NULL) as ban_numbers,
        COUNT(DISTINCT s.id) as total_subscribers,
        COALESCE(SUM(s.monthly_value), 0) as total_monthly_value,
        EXISTS(SELECT 1 FROM follow_up_prospects fup WHERE fup.client_id = c.id) as en_seguimiento
      FROM clients c
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      WHERE c.id = ANY($1::uuid[])
      GROUP BY c.id, c.name, c.created_at, c.salesperson_id, sp.name
      ORDER BY c.created_at
    `, [dup.client_ids]);

    let item = {
      num: i + 1,
      nombre: dup.nombre_normalizado,
      cantidad: dup.cantidad_duplicados,
      registros: details.rows.map(r => ({
        id: r.id,
        fecha: new Date(r.created_at).toLocaleString('es-ES', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }),
        vendedor: r.salesperson_name || 'SIN ASIGNAR',
        bans: r.total_bans,
        ban_numbers: r.ban_numbers?.join(', ') || 'NINGUNO',
        suscriptores: r.total_subscribers,
        valor_mensual: parseFloat(r.total_monthly_value),
        en_seguimiento: r.en_seguimiento
      }))
    };

    reporte.push(item);

    // Mostrar en consola con formato
    console.log(`┌${'─'.repeat(78)}┐`);
    console.log(`│ [${(i + 1).toString().padStart(3)}] ${dup.nombre_normalizado.substring(0, 68).padEnd(68)} │`);
    console.log(`│      Cantidad de duplicados: ${dup.cantidad_duplicados.toString().padEnd(52)} │`);
    console.log(`└${'─'.repeat(78)}┘`);

    details.rows.forEach((reg, idx) => {
      console.log(`\n   Registro ${idx + 1}:`);
      console.log(`   ├─ ID: ${reg.id}`);
      console.log(`   ├─ Fecha creación: ${new Date(reg.created_at).toLocaleString('es-ES')}`);
      console.log(`   ├─ Vendedor: ${reg.salesperson_name || '❌ SIN ASIGNAR'}`);
      console.log(`   ├─ BANs: ${reg.total_bans} ${reg.ban_numbers?.length > 0 ? `(${reg.ban_numbers.join(', ')})` : ''}`);
      console.log(`   ├─ Suscriptores: ${reg.total_subscribers}`);
      console.log(`   ├─ Valor mensual: $${parseFloat(reg.total_monthly_value).toFixed(2)}`);
      console.log(`   └─ En seguimiento: ${reg.en_seguimiento ? '✅ SÍ' : '❌ NO'}`);
    });

    // Análisis de diferencias
    console.log('\n   📋 ANÁLISIS:');
    const hayVendedorDiferente = details.rows.some((r, i, arr) => 
      i > 0 && r.salesperson_id !== arr[0].salesperson_id
    );
    const hayDatosDiferentes = details.rows.some(r => r.total_bans > 0 || r.total_subscribers > 0);
    const todosSinDatos = details.rows.every(r => r.total_bans === 0 && r.total_subscribers === 0);
    
    if (todosSinDatos) {
      console.log('   ⚠️  TODOS SIN DATOS - Candidatos a eliminar todos excepto el más antiguo');
    } else if (hayDatosDiferentes) {
      const conDatos = details.rows.filter(r => r.total_bans > 0 || r.total_subscribers > 0);
      if (conDatos.length === 1) {
        console.log('   ✅ UN SOLO REGISTRO CON DATOS - Reasignar BANs a este y eliminar vacíos');
        console.log(`      → Mantener: ${conDatos[0].id}`);
      } else {
        console.log('   ⚠️  MÚLTIPLES CON DATOS - Requiere fusión manual');
      }
    }
    
    if (hayVendedorDiferente) {
      console.log('   ⚠️  VENDEDORES DIFERENTES - Verificar asignación correcta antes de fusionar');
    }

    console.log('');
  }

  // Resumen estadístico
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          RESUMEN ESTADÍSTICO                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const stats = {
    total_duplicados: duplicates.rows.length,
    con_2_registros: duplicates.rows.filter(d => d.cantidad_duplicados === 2).length,
    con_3_registros: duplicates.rows.filter(d => d.cantidad_duplicados === 3).length,
    con_4_o_mas: duplicates.rows.filter(d => d.cantidad_duplicados >= 4).length,
    max_duplicados: Math.max(...duplicates.rows.map(d => d.cantidad_duplicados))
  };

  console.log(`📊 Distribución de duplicados:`);
  console.log(`   • Con 2 duplicados: ${stats.con_2_registros} nombres`);
  console.log(`   • Con 3 duplicados: ${stats.con_3_registros} nombres`);
  console.log(`   • Con 4+ duplicados: ${stats.con_4_o_mas} nombres`);
  console.log(`   • Máximo encontrado: ${stats.max_duplicados} registros del mismo nombre\n`);

  // Top 10 peores casos
  console.log('🔥 TOP 10 PEORES CASOS (más duplicados):\n');
  duplicates.rows.slice(0, 10).forEach((d, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${d.nombre_normalizado.substring(0, 50).padEnd(50)} → ${d.cantidad_duplicados} duplicados`);
  });

  await pool.end();
  
  return reporte;
}

generateComparisonReport();
