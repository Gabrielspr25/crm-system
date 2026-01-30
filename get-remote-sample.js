
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

async function getSample() {
    try {
        console.log('--- Obteniendo Muestra de Ventas Movil ---');
        const res = await pool.query(`
            SELECT vm.*, t.nombre as tienda_nombre, v.nombre as vendedor_nombre, c.nombre as cliente_nombre
            FROM ventas_movil vm
            LEFT JOIN tiendas t ON vm.id_tienda = t.id
            LEFT JOIN vendedores v ON vm.id_usuario = v.id
            LEFT JOIN clientes c ON vm.id_cliente = c.cliente_id
            ORDER BY vm.fecha_activacion DESC
            LIMIT 1
        `);
        console.log(JSON.stringify(res.rows[0], null, 2));
        await pool.end();
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

getSample();
