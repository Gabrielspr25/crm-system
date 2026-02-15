import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verificarVenta() {
  try {
    const result = await pool.query(`
      SELECT 
        c.name,
        s.contract_term
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      WHERE c.name ILIKE '%santa gema%'
      ORDER BY c.created_at DESC
      LIMIT 1
    `);

    console.log('\n═══════════════════════════════════════');
    
    if (result.rows.length === 0) {
      console.log('¿Trae el cliente? NO');
      console.log('═══════════════════════════════════════');
      return;
    }

    console.log('¿Trae el cliente? SÍ');
    console.log(`Cliente: ${result.rows[0].name}`);
    console.log('');
    
    const meses = result.rows[0].contract_term;
    console.log(`¿Ve los 24 meses? ${meses === 24 ? 'SÍ' : 'NO'}`);
    console.log(`Duración actual: ${meses || 'null'} meses`);
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

verificarVenta();
