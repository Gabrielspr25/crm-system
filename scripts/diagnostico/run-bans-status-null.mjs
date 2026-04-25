import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

try {
    const total = await pool.query('SELECT COUNT(*)::int AS n FROM bans WHERE status IS NULL');
    const n = total.rows[0]?.n ?? 0;
    console.log(`\n=== Diagnostico BANs con status NULL ===`);
    console.log(`Host: ${process.env.DB_HOST} / DB: ${process.env.DB_NAME}`);
    console.log(`Total BANs con status NULL: ${n}\n`);

    if (n === 0) {
        console.log('No hay BANs con status NULL. Nada que limpiar.');
    } else {
        const detalle = await pool.query(`
            SELECT
                b.id,
                b.ban_number,
                b.account_type,
                b.dealer_code,
                b.dealer_name,
                b.reason_desc,
                b.sub_status_report,
                b.created_at,
                b.updated_at,
                c.id   AS client_id,
                c.name AS client_name,
                (SELECT COUNT(*)::int FROM subscribers s WHERE s.ban_id = b.id) AS total_subs,
                (SELECT COUNT(*)::int FROM subscribers s WHERE s.ban_id = b.id AND s.status = 'activo')    AS subs_activos,
                (SELECT COUNT(*)::int FROM subscribers s WHERE s.ban_id = b.id AND s.status = 'cancelado') AS subs_cancelados
              FROM bans b
              LEFT JOIN clients c ON c.id = b.client_id
             WHERE b.status IS NULL
             ORDER BY b.created_at DESC
        `);
        console.log('Detalle:\n');
        for (const row of detalle.rows) {
            console.log(JSON.stringify(row, null, 2));
            console.log('---');
        }

        const sugerencia = detalle.rows.map(row => ({
            id: row.id,
            ban_number: row.ban_number,
            client: row.client_name,
            total_subs: row.total_subs,
            subs_activos: row.subs_activos,
            subs_cancelados: row.subs_cancelados,
            sugerencia: row.subs_activos > 0 ? 'A (tiene subs activos)' : (row.total_subs > 0 ? 'C (solo subs cancelados)' : 'C (sin subs)'),
        }));
        console.log('\n=== Resumen / sugerencia automatica ===');
        console.table(sugerencia);
    }
} catch (err) {
    console.error('Error ejecutando diagnostico:', err.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
