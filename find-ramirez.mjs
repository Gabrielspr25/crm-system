import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function findRamirez() {
  console.log('\n🔍 Buscando RAMIREZ & RAMIREZ APPLIANCE INC...\n');

  const results = await pool.query(`
    SELECT 
      c.id,
      c.name,
      c.created_at,
      c.salesperson_id,
      sp.name as salesperson_name,
      COUNT(DISTINCT b.id) as total_bans,
      array_agg(DISTINCT b.ban_number ORDER BY b.ban_number) as ban_numbers,
      COUNT(DISTINCT s.id) as total_subscribers,
      COALESCE(SUM(s.monthly_value), 0) as total_monthly_value
    FROM clients c
    LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
    LEFT JOIN bans b ON b.client_id = c.id
    LEFT JOIN subscribers s ON s.ban_id = b.id
    WHERE UPPER(TRIM(c.name)) LIKE '%RAMIREZ%APPLIANCE%'
    GROUP BY c.id, c.name, c.created_at, c.salesperson_id, sp.name
    ORDER BY c.created_at
  `);

  if (results.rows.length === 0) {
    console.log('❌ No se encontraron clientes con ese nombre.\n');
    await pool.end();
    return;
  }

  console.log(`✅ Encontrados ${results.rows.length} registros:\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  results.rows.forEach((client, i) => {
    console.log(`[${i + 1}] ${client.name}`);
    console.log(`    ID: ${client.id}`);
    console.log(`    Creado: ${new Date(client.created_at).toLocaleString('es-ES')}`);
    console.log(`    Vendedor: ${client.salesperson_name || '❌ SIN ASIGNAR'}`);
    console.log(`    BANs (${client.total_bans}): ${client.ban_numbers.filter(b => b).join(', ') || 'NINGUNO'}`);
    console.log(`    Suscriptores: ${client.total_subscribers}`);
    console.log(`    Valor mensual: $${parseFloat(client.total_monthly_value).toFixed(2)}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await pool.end();
}

findRamirez();
