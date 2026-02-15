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
    // Check ventatipo table for PYMES types
    const tipos = await pool.query(`
      SELECT * FROM ventatipo WHERE id IN (138, 139, 140, 141) ORDER BY id
    `);
    console.log('=== TIPOS DE VENTA PYMES ===');
    tipos.rows.forEach(r => console.log(JSON.stringify(r)));

    // Count ventas by these types
    const ventas = await pool.query(`
      SELECT vt.id, vt.nombre, count(v.id) as total_ventas
      FROM ventatipo vt
      LEFT JOIN venta v ON v.ventatipoid = vt.id
      WHERE vt.id IN (138, 139, 140, 141)
      GROUP BY vt.id, vt.nombre
      ORDER BY vt.id
    `).catch(async () => {
      // Try alternate column name
      return pool.query(`
        SELECT vt.id, count(v.id) as total_ventas
        FROM ventatipo vt
        LEFT JOIN venta v ON v.venta_tipo_id = vt.id
        WHERE vt.id IN (138, 139, 140, 141)
        GROUP BY vt.id
        ORDER BY vt.id
      `);
    });
    console.log('\n=== VENTAS POR TIPO PYMES ===');
    ventas.rows.forEach(r => console.log(`  ID ${r.id} (${r.nombre || '?'}): ${r.total_ventas} ventas`));

    // Total
    const total = await pool.query(`
      SELECT count(*) as total FROM venta WHERE ventatipoid IN (138, 139, 140, 141)
    `).catch(() => pool.query(`SELECT count(*) as total FROM venta WHERE venta_tipo_id IN (138, 139, 140, 141)`));
    console.log(`\n  TOTAL VENTAS PYMES: ${total.rows[0].total}`);

    // Unique clients from those sales
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name='venta' ORDER BY ordinal_position
    `);
    console.log('\n=== COLUMNAS TABLA VENTA ===');
    cols.rows.forEach(r => console.log('  ', r.column_name));

  } catch(e) {
    console.log('Error:', e.message);
  }
  pool.end();
}
main();
