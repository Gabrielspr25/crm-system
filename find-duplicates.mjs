import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function findDuplicates() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        CLIENTES DUPLICADOS EN CRM (MISMO NOMBRE)          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Buscar nombres que aparecen más de una vez
  const duplicates = await pool.query(`
    SELECT 
      UPPER(TRIM(name)) as nombre_normalizado,
      COUNT(*) as cantidad,
      array_agg(id::text ORDER BY created_at) as client_ids,
      array_agg(name ORDER BY created_at) as nombres_originales,
      array_agg(created_at::text ORDER BY created_at) as fechas_creacion
    FROM clients
    WHERE name IS NOT NULL AND TRIM(name) != ''
    GROUP BY UPPER(TRIM(name))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, UPPER(TRIM(name))
  `);

  if (duplicates.rows.length === 0) {
    console.log('✅ No se encontraron clientes duplicados por nombre.\n');
    await pool.end();
    return;
  }

  console.log(`⚠️ Encontrados ${duplicates.rows.length} nombres duplicados:\n`);

  for (let i = 0; i < duplicates.rows.length; i++) {
    const dup = duplicates.rows[i];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}] ${dup.nombre_normalizado}`);
    console.log(`    Cantidad de registros: ${dup.cantidad}`);
    
    // Obtener detalles de cada cliente duplicado
    for (let j = 0; j < dup.client_ids.length; j++) {
      const clientId = dup.client_ids[j];
      
      const details = await pool.query(`
        SELECT 
          c.id,
          c.name,
          c.created_at,
          c.salesperson_id,
          sp.name as salesperson_name,
          COUNT(DISTINCT b.id) as total_bans,
          COUNT(DISTINCT s.id) as total_subscribers,
          COALESCE(SUM(s.monthly_value), 0) as total_monthly_value
        FROM clients c
        LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
        LEFT JOIN bans b ON b.client_id = c.id
        LEFT JOIN subscribers s ON s.ban_id = b.id
        WHERE c.id = $1
        GROUP BY c.id, c.name, c.created_at, c.salesperson_id, sp.name
      `, [clientId]);

      const client = details.rows[0];
      console.log(`\n    Registro ${j + 1}:`);
      console.log(`      ID: ${client.id}`);
      console.log(`      Nombre original: "${client.name}"`);
      console.log(`      Creado: ${new Date(client.created_at).toLocaleString('es-ES')}`);
      console.log(`      Vendedor: ${client.salesperson_name || 'SIN ASIGNAR'}`);
      console.log(`      BANs: ${client.total_bans} | Suscriptores: ${client.total_subscribers}`);
      console.log(`      Valor mensual total: $${parseFloat(client.total_monthly_value).toFixed(2)}`);
    }
    console.log('');
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`📊 RESUMEN: ${duplicates.rows.length} nombres duplicados encontrados\n`);

  await pool.end();
}

findDuplicates();
