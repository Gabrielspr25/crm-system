const { Pool } = require('pg');

const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

async function analyze() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         CLIENTES CON FOLLOW-UP COMPLETADO EN CRM          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Clientes con follow_up completado
    const clientesCompletados = await crmPool.query(`
      SELECT 
        c.id as client_id,
        c.name as client_name,
        sp.name as salesperson,
        fup.completed_date,
        fup.id as follow_up_id,
        COUNT(DISTINCT b.id) as cantidad_bans,
        COUNT(s.id) as cantidad_suscriptores,
        SUM(s.monthly_value) as total_mensualidad
      FROM follow_up_prospects fup
      INNER JOIN clients c ON fup.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      WHERE fup.completed_date IS NOT NULL
      GROUP BY c.id, c.name, sp.name, fup.completed_date, fup.id
      ORDER BY fup.completed_date DESC
    `);
    
    console.log(`📊 Total clientes con follow-up completado: ${clientesCompletados.rows.length}\n`);
    
    if (clientesCompletados.rows.length === 0) {
      console.log('⚠️  No hay clientes con follow-up completado\n');
    } else {
      clientesCompletados.rows.forEach((client, i) => {
        console.log(`[${i + 1}] ${client.client_name}`);
        console.log(`    Vendedor: ${client.salesperson || 'SIN ASIGNAR'}`);
        console.log(`    BANs: ${client.cantidad_bans}`);
        console.log(`    Suscriptores: ${client.cantidad_suscriptores}`);
        console.log(`    Total mensualidad: $${Number(client.total_mensualidad || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
        console.log(`    Completado: ${new Date(client.completed_date).toLocaleDateString('es-ES')}`);
        console.log('');
      });
    }
    
    // Clientes con follow-up pero sin completar
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLIENTES CON FOLLOW-UP ACTIVO (SIN COMPLETAR):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const clientesActivos = await crmPool.query(`
      SELECT 
        c.id as client_id,
        c.name as client_name,
        sp.name as salesperson,
        fup.id as follow_up_id,
        COUNT(DISTINCT b.id) as cantidad_bans,
        COUNT(s.id) as cantidad_suscriptores
      FROM follow_up_prospects fup
      INNER JOIN clients c ON fup.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      WHERE fup.completed_date IS NULL
        AND fup.is_active = true
      GROUP BY c.id, c.name, sp.name, fup.id
      ORDER BY c.name
      LIMIT 20
    `);
    
    console.log(`📋 Total clientes activos: ${clientesActivos.rows.length}\n`);
    
    if (clientesActivos.rows.length > 0) {
      clientesActivos.rows.forEach((client, i) => {
        console.log(`[${i + 1}] ${client.client_name}`);
        console.log(`    Vendedor: ${client.salesperson || 'SIN ASIGNAR'}`);
        console.log(`    BANs: ${client.cantidad_bans} | Suscriptores: ${client.cantidad_suscriptores}`);
        console.log('');
      });
    }
    
    console.log('══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await crmPool.end();
  }
}

analyze();
