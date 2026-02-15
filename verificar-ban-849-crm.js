import pkg from 'pg';
const { Pool } = pkg;

const currentPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verificarBAN849() {
  try {
    console.log('\n=== VERIFICANDO BAN 849361537 EN CRM ===\n');
    
    const ban = await currentPool.query(`
      SELECT b.*, c.name as client_name, c.salesperson_id
      FROM bans b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.ban_number = '849361537'
    `);
    
    if (ban.rows.length === 0) {
      console.log('❌ BAN NO existe en CRM\n');
      return;
    }
    
    console.log('✓ BAN ENCONTRADO:');
    console.log(`  Cliente: ${ban.rows[0].client_name}`);
    console.log(`  Salesperson: ${ban.rows[0].salesperson_id}\n`);
    
    const banId = ban.rows[0].id;
    
    // Buscar suscriptores
    const subs = await currentPool.query(`
      SELECT * FROM subscribers WHERE ban_id = $1
    `, [banId]);
    
    console.log(`  Suscriptores registrados: ${subs.rows.length}\n`);
    
    if (subs.rows.length > 0) {
      for (const sub of subs.rows) {
        console.log(`  • Tel: ${sub.phone} | Valor: $${sub.monthly_value || '0'} | Activación: ${sub.created_at || 'N/A'}`);
      }
    }
    
    // Buscar follow_up
    const clientId = ban.rows[0].client_id;
    const followUp = await currentPool.query(`
      SELECT * FROM follow_up_prospects WHERE client_id = $1
    `, [clientId]);
    
    console.log(`\n  Follow-up prospects: ${followUp.rows.length}`);
    if (followUp.rows.length > 0) {
      followUp.rows.forEach(f => {
        console.log(`    ID: ${f.id} | Completado: ${f.completed_date ? 'SÍ' : 'NO'}`);
      });
    }
    
    // Buscar reportes
    const reports = await currentPool.query(`
      SELECT sr.*, s.phone
      FROM subscriber_reports sr
      JOIN subscribers s ON s.id = sr.subscriber_id
      WHERE s.ban_id = $1
    `, [banId]);
    
    console.log(`\n  Reportes generados: ${reports.rows.length}`);
    if (reports.rows.length > 0) {
      reports.rows.forEach(r => {
        console.log(`    Tel: ${r.phone} | Company: $${r.company_earnings || '0'} | Vendor: $${r.vendor_commission || '0'}`);
      });
    }
    
    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('DATOS EN LEGACY (para migrar):');
    console.log('════════════════════════════════════════════════════════════');
    console.log('Tel 7879401766: Comisión $153 + Features $31.98 + Retención $16 = TOTAL $200.98');
    console.log('Tel 7879394789: Comisión $240 + Features $31.98 + Retención $25 = TOTAL $296.98');
    console.log('Tel 7874479797: Comisión $240 + Features $31.98 + Retención $25 = TOTAL $296.98');
    console.log('Tel 7875153772: Comisión $108 + Features $0 + Retención $8 = TOTAL $116.00');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await currentPool.end();
  }
}

verificarBAN849();
