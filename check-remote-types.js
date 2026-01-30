
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'celularinnovation',
    connectionTimeoutMillis: 5000
});

async function checkTypes() {
    const queries = [
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ventas_movil' AND column_name IN ('id_tienda', 'id_usuario', 'id_cliente')",
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tiendas' AND column_name = 'id'",
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendedores' AND column_name = 'id'",
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'cliente_id'"
    ];
    for (const q of queries) {
        const res = await pool.query(q);
        console.log(res.rows);
    }
    await pool.end();
}
checkTypes();
