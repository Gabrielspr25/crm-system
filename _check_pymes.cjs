const { Pool } = require('pg');
const pool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
});

async function main() {
  try {
    // Check ban types in crm_nuevo_banes
    const banTypes = await pool.query(`
      SELECT DISTINCT ban_type, count(*) as total 
      FROM crm_nuevo_banes 
      GROUP BY ban_type 
      ORDER BY total DESC
    `).catch(() => null);
    
    if (banTypes) {
      console.log('=== TIPOS DE BAN EN crm_nuevo_banes ===');
      banTypes.rows.forEach(r => console.log(`  ${r.ban_type || 'NULL'}: ${r.total}`));
    }

    // Check columns of crm_nuevo_banes
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'crm_nuevo_banes' ORDER BY ordinal_position
    `);
    console.log('\n=== COLUMNAS crm_nuevo_banes ===');
    cols.rows.forEach(r => console.log('  ', r.column_name));

    // PYMES bans - try different column names
    const pymesCheck = await pool.query(`
      SELECT * FROM crm_nuevo_banes LIMIT 3
    `);
    console.log('\n=== SAMPLE BANES (3 rows) ===');
    console.log(JSON.stringify(pymesCheck.rows, null, 2));

    // Check client types table
    const clientTypes = await pool.query(`
      SELECT * FROM crm_nuevo_types_clients ORDER BY id
    `).catch(() => null);
    if (clientTypes) {
      console.log('\n=== TIPOS DE CLIENTES ===');
      clientTypes.rows.forEach(r => console.log(JSON.stringify(r)));
    }

    // Check crm_nuevo_client_types_clients
    const ctc = await pool.query(`
      SELECT type_client_id, count(*) as total 
      FROM crm_nuevo_client_types_clients 
      GROUP BY type_client_id ORDER BY total DESC
    `).catch(() => null);
    if (ctc) {
      console.log('\n=== CLIENTES POR TIPO ===');
      ctc.rows.forEach(r => console.log(`  type_id ${r.type_client_id}: ${r.total} clientes`));
    }

    // Count unique PYMES clients (by ban type or client type)
    const pymesBans = await pool.query(`
      SELECT count(DISTINCT b.client_id) as unique_clients, count(*) as total_bans
      FROM crm_nuevo_banes b
      WHERE LOWER(COALESCE(b.ban_type, '')) LIKE '%pyme%'
    `).catch(() => null);
    if (pymesBans) {
      console.log('\n=== BANES TIPO PYMES ===');
      console.log(`  Clientes únicos: ${pymesBans.rows[0].unique_clients}`);
      console.log(`  Total BANs: ${pymesBans.rows[0].total_bans}`);
    }

  } catch(e) {
    console.log('Error:', e.message);
  }
  pool.end();
}
main();
