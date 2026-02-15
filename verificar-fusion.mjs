import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function verificarFusion() {
    try {
        console.log('\n🔍 VERIFICACIÓN POST-FUSIÓN\n');
        console.log('=' .repeat(60));

        // Total de clientes
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM clients');
        console.log(`📊 Total de clientes: ${totalResult.rows[0].total}`);

        // Clientes con nombre
        const conNombreResult = await pool.query('SELECT COUNT(*) as total FROM clients WHERE name IS NOT NULL AND name != \'\'');
        console.log(`📝 Clientes con nombre: ${conNombreResult.rows[0].total}`);

        // Nombres únicos
        const uniqueResult = await pool.query('SELECT COUNT(DISTINCT UPPER(TRIM(name))) as total FROM clients WHERE name IS NOT NULL AND name != \'\'');
        console.log(`✨ Nombres únicos: ${uniqueResult.rows[0].total}`);

        // Duplicados restantes
        const dupsResult = await pool.query(`
            SELECT COUNT(*) as total_grupos
            FROM (
                SELECT UPPER(TRIM(name)) as nombre
                FROM clients
                WHERE name IS NOT NULL AND name != ''
                GROUP BY UPPER(TRIM(name))
                HAVING COUNT(*) > 1
            ) duplicados
        `);
        console.log(`🔁 Duplicados restantes: ${dupsResult.rows[0].total_grupos}`);

        // Total de BANs
        const bansResult = await pool.query('SELECT COUNT(*) as total FROM bans');
        console.log(`📞 Total de BANs: ${bansResult.rows[0].total}`);

        // Total de suscriptores
        const subsResult = await pool.query('SELECT COUNT(*) as total FROM subscribers');
        console.log(`📱 Total de suscriptores: ${subsResult.rows[0].total}`);

        console.log('=' .repeat(60));

        if (dupsResult.rows[0].total_grupos === '0') {
            console.log('\n✅ ¡PERFECTO! No hay duplicados en la base de datos.\n');
        } else {
            console.log(`\n⚠️  Aún hay ${dupsResult.rows[0].total_grupos} grupos duplicados.\n`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

verificarFusion();
