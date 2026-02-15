const { Pool } = require('pg');
async function main() {
  const tango = new Pool({ host: '167.99.12.125', port: 5432, user: 'postgres', password: 'fF00JIRFXc', database: 'claropr' });

  // 1. Ver TODAS las columnas de la tabla venta
  const cols = await tango.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'venta'
    ORDER BY ordinal_position
  `);
  console.log('=== COLUMNAS DE TABLA venta ===');
  console.table(cols.rows);

  // 2. Ver el registro completo de ventaid 79582
  const row = await tango.query(`SELECT * FROM venta WHERE ventaid = 79582`);
  console.log('\n=== REGISTRO COMPLETO ventaid=79582 ===');
  console.log(row.rows[0]);

  await tango.end();
}
main().catch(e => { console.error(e); process.exit(1); });
