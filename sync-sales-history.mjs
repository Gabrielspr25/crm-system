import pg from 'pg';
const { Pool } = pg;

const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function syncSalesHistory() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SINCRONIZAR HISTORIAL DE VENTAS DESDE REPORTES          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar cuántos follow_up_prospects completados existen
    const fupCompleted = await crmPool.query(`
      SELECT COUNT(*) as total
      FROM follow_up_prospects
      WHERE completed_date IS NOT NULL
    `);
    console.log(`📊 Follow-up prospects completados: ${fupCompleted.rows[0].total}`);

    // 2. Verificar cuántos subscribers están asociados a clientes con follow-up completado
    const subscribersPendientes = await crmPool.query(`
      SELECT COUNT(DISTINCT s.id) as total
      FROM subscribers s
      INNER JOIN bans b ON s.ban_id = b.id
      INNER JOIN clients c ON b.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN vendor_salesperson_mapping vsm ON sp.id = vsm.salesperson_id
      INNER JOIN LATERAL (
        SELECT fup.id, fup.completed_date
        FROM follow_up_prospects fup
        WHERE fup.client_id = c.id AND fup.completed_date IS NOT NULL
        ORDER BY fup.completed_date DESC
        LIMIT 1
      ) fup ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM sales_history sh 
        WHERE sh.subscriber_id = s.id
          AND sh.client_id = c.id
          AND sh.prospect_id = fup.id
      )
    `);
    console.log(`🔄 Subscribers pendientes de sincronizar: ${subscribersPendientes.rows[0].total}`);

    // 3. Ejecutar la sincronización
    const subscriptores = await crmPool.query(`
      SELECT 
        s.id as subscriber_id,
        c.id as client_id,
        c.name as company_name,
        c.salesperson_id,
        vsm.vendor_id,
        s.monthly_value,
        b.ban_number,
        fup.id as prospect_id,
        fup.completed_date
      FROM subscribers s
      INNER JOIN bans b ON s.ban_id = b.id
      INNER JOIN clients c ON b.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN vendor_salesperson_mapping vsm ON sp.id = vsm.salesperson_id
      INNER JOIN LATERAL (
        SELECT fup.id, fup.completed_date
        FROM follow_up_prospects fup
        WHERE fup.client_id = c.id AND fup.completed_date IS NOT NULL
        ORDER BY fup.completed_date DESC
        LIMIT 1
      ) fup ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM sales_history sh 
        WHERE sh.subscriber_id = s.id
          AND sh.client_id = c.id
          AND sh.prospect_id = fup.id
      )
      ORDER BY fup.completed_date DESC
    `);

    if (subscriptores.rows.length === 0) {
      console.log('\n✅ No hay ventas nuevas para sincronizar.\n');
      await crmPool.end();
      return;
    }

    console.log(`\n🔄 Sincronizando ${subscriptores.rows.length} ventas...\n`);

    let synced = 0;
    for (const sub of subscriptores.rows) {
      await crmPool.query(`
        INSERT INTO sales_history (
          client_id, prospect_id, subscriber_id, company_name,
          vendor_id, salesperson_id, total_amount, monthly_value,
          sale_date, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        )
      `, [
        sub.client_id,
        sub.prospect_id,
        sub.subscriber_id,
        sub.company_name,
        sub.vendor_id,
        sub.salesperson_id,
        sub.monthly_value || 0,
        sub.monthly_value || 0,
        sub.completed_date,
        `Sincronizado automáticamente desde reportes. BAN: ${sub.ban_number || 'N/A'}`
      ]);
      
      synced++;
      console.log(`  ✅ [${synced}/${subscriptores.rows.length}] Cliente: ${sub.company_name} - $${sub.monthly_value || 0}`);
    }

    console.log(`\n✅ Sincronización completada: ${synced} ventas guardadas en historial.\n`);

    // 4. Verificar resultados
    const totalHistorial = await crmPool.query('SELECT COUNT(*) as total FROM sales_history');
    console.log(`📊 Total registros en sales_history: ${totalHistorial.rows[0].total}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await crmPool.end();
  }
}

syncSalesHistory();
