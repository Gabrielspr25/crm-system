import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function createVentaPrueba() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Verificar si ya existe el cliente
    console.log('\n=== 1. VERIFICANDO CLIENTE ===');
    const existingClient = await client.query(
      `SELECT id, name FROM clients WHERE name ILIKE '%santa gema%'`
    );
    
    let clientId;
    if (existingClient.rows.length > 0) {
      clientId = existingClient.rows[0].id;
      console.log(`✓ Cliente ya existe: ${existingClient.rows[0].name} (${clientId})`);
    } else {
      // Obtener un vendedor para asignar
      const vendedor = await client.query(
        `SELECT id, name FROM salespeople LIMIT 1`
      );
      
      const insertClient = await client.query(`
        INSERT INTO clients (name, salesperson_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING id, name
      `, ['Colegio Santa Gema', vendedor.rows[0].id]);
      
      clientId = insertClient.rows[0].id;
      console.log(`✓ Cliente creado: ${insertClient.rows[0].name} (${clientId})`);
      console.log(`  Vendedor asignado: ${vendedor.rows[0].name}`);
    }

    // 2. Verificar si ya existe el BAN
    console.log('\n=== 2. VERIFICANDO BAN ===');
    const existingBan = await client.query(
      `SELECT id, ban_number FROM bans WHERE ban_number = $1`,
      ['719400825']
    );
    
    let banId;
    if (existingBan.rows.length > 0) {
      banId = existingBan.rows[0].id;
      console.log(`✓ BAN ya existe: ${existingBan.rows[0].ban_number} (${banId})`);
    } else {
      const insertBan = await client.query(`
        INSERT INTO bans (client_id, ban_number, account_type, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, ban_number, account_type
      `, [clientId, '719400825', 'FIJO', 'A']);
      
      banId = insertBan.rows[0].id;
      console.log(`✓ BAN creado: ${insertBan.rows[0].ban_number} (${banId})`);
      console.log(`  Tipo de cuenta: ${insertBan.rows[0].account_type} (PYMES)`);
    }

    // 3. Verificar/crear suscriptor de prueba
    console.log('\n=== 3. CREANDO SUSCRIPTOR ===');
    const existingSub = await client.query(
      `SELECT id, phone FROM subscribers WHERE ban_id = $1`,
      [banId]
    );
    
    if (existingSub.rows.length > 0) {
      console.log(`✓ BAN ya tiene ${existingSub.rows.length} suscriptor(es):`);
      existingSub.rows.forEach((sub, idx) => {
        console.log(`  ${idx+1}. ${sub.phone} (${sub.id})`);
      });
    } else {
      const insertSub = await client.query(`
        INSERT INTO subscribers (ban_id, phone, line_type, contract_end_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, phone, line_type
      `, [banId, '7877001234', 'NEW', new Date(Date.now() + 365*24*60*60*1000)]);
      
      console.log(`✓ Suscriptor creado: ${insertSub.rows[0].phone} (${insertSub.rows[0].id})`);
      console.log(`  Tipo: ${insertSub.rows[0].line_type} (Nuevo)`);
      console.log(`  Vence: en 1 año`);
    }

    await client.query('COMMIT');

    // 4. Mostrar resumen completo
    console.log('\n=== 4. RESUMEN DE VENTA CREADA ===');
    const resumen = await client.query(`
      SELECT 
        c.name as cliente,
        c.id as client_id,
        b.ban_number,
        b.account_type,
        b.status as ban_status,
        COUNT(s.id) as total_suscriptores,
        sp.name as vendedor
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, b.ban_number, b.account_type, b.status, sp.name
    `, [clientId]);

    console.log('\n📊 DATOS FINALES:');
    console.log('─────────────────────────────────────');
    console.log(`Cliente:      ${resumen.rows[0].cliente}`);
    console.log(`BAN:          ${resumen.rows[0].ban_number}`);
    console.log(`Tipo:         ${resumen.rows[0].account_type} (PYMES)`);
    console.log(`Estado:       ${resumen.rows[0].ban_status === 'A' ? 'Activo' : 'Inactivo'}`);
    console.log(`Suscriptores: ${resumen.rows[0].total_suscriptores}`);
    console.log(`Vendedor:     ${resumen.rows[0].vendedor}`);
    console.log('─────────────────────────────────────');

    // 5. Verificar productos aplicables
    console.log('\n=== 5. PRODUCTOS APLICABLES (PYMES FIJO) ===');
    const productos = await client.query(`
      SELECT p.name, p.commission_percentage, c.name as categoria
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE c.name = 'Fijo'
      ORDER BY p.name
    `);
    
    productos.rows.forEach(prod => {
      console.log(`  • ${prod.name} - Comisión: ${prod.commission_percentage}%`);
    });

    console.log('\n✅ Venta de prueba creada exitosamente!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createVentaPrueba();
