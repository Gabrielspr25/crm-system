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
    // Tipos de clientes
    console.log('=== TIPOS DE CLIENTES ===');
    const types = await pool.query('SELECT * FROM crm_nuevo_types_clients ORDER BY id');
    types.rows.forEach(r => console.log(`  ID ${r.id}: ${r.name} (status: ${r.status})`));

    // Clientes por tipo
    console.log('\n=== CLIENTES POR TIPO ===');
    const byType = await pool.query(`
      SELECT tc.type_client_id, t.name as tipo, count(DISTINCT tc.client_id) as clientes
      FROM crm_nuevo_client_types_clients tc
      LEFT JOIN crm_nuevo_types_clients t ON tc.type_client_id = t.id
      GROUP BY tc.type_client_id, t.name
      ORDER BY clientes DESC
    `);
    byType.rows.forEach(r => console.log(`  ${r.tipo || 'NULL'} (id=${r.type_client_id}): ${r.clientes} clientes`));

    // PYMES específicamente - clientes con BANs
    console.log('\n=== PYMES CON BANES ===');
    const pymes = await pool.query(`
      SELECT count(DISTINCT tc.client_id) as clientes_pymes,
             count(DISTINCT b.id) as total_bans
      FROM crm_nuevo_client_types_clients tc
      JOIN crm_nuevo_banes b ON b.id_client = tc.client_id
      WHERE tc.type_client_id = 1
    `);
    console.log(`  Clientes PYMES con BANs: ${pymes.rows[0].clientes_pymes}`);
    console.log(`  Total BANs de PYMES: ${pymes.rows[0].total_bans}`);

    // Total PYMES sin importar si tienen BAN
    const pymesTotal = await pool.query(`
      SELECT count(DISTINCT client_id) as total
      FROM crm_nuevo_client_types_clients
      WHERE type_client_id = 1
    `);
    console.log(`  Total clientes tipo PYMES: ${pymesTotal.rows[0].total}`);

    // PYMES con suscriptores
    const pymesSubs = await pool.query(`
      SELECT count(DISTINCT s.id) as total_subs
      FROM crm_nuevo_suscriptores s
      JOIN crm_nuevo_banes b ON b.id = s.id_ban OR b.ban = s.ban
      JOIN crm_nuevo_client_types_clients tc ON tc.client_id = b.id_client
      WHERE tc.type_client_id = 1
    `).catch(() => null);
    if (pymesSubs) {
      console.log(`  Suscriptores PYMES: ${pymesSubs.rows[0].total_subs}`);
    }

    // Verificar columnas de suscriptores
    const subCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'crm_nuevo_suscriptores' ORDER BY ordinal_position
    `).catch(() => null);
    if (subCols) {
      console.log('\n=== COLUMNAS crm_nuevo_suscriptores ===');
      subCols.rows.forEach(r => console.log('  ', r.column_name));
    }

    // Count suscriptores
    const subCount = await pool.query('SELECT count(*) FROM crm_nuevo_suscriptores').catch(() => null);
    if (subCount) console.log(`\nTotal suscriptores en Tango: ${subCount.rows[0].count}`);

    // Ahora comparar con CRM
    console.log('\n========================================');
    console.log('RESUMEN: Lo que había que traer vs lo que se trajo');
    console.log('========================================');

  } catch(e) {
    console.log('Error:', e.message);
  }
  pool.end();
}
main();
