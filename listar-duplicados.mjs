import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function listarDuplicados() {
    try {
        console.log('\n🔍 LISTANDO DUPLICADOS ACTUALES\n');
        console.log('=' .repeat(80));

        const duplicatesQuery = `
            SELECT 
                UPPER(TRIM(name)) as nombre,
                COUNT(*) as cantidad,
                array_agg(id::text) as ids
            FROM clients
            WHERE name IS NOT NULL AND TRIM(name) != ''
            GROUP BY UPPER(TRIM(name))
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC, UPPER(TRIM(name))
            LIMIT 20;
        `;

        const result = await pool.query(duplicatesQuery);

        if (result.rows.length === 0) {
            console.log('✅ No hay duplicados en la base de datos\n');
        } else {
            console.log(`⚠️  Encontrados ${result.rows.length} nombres duplicados:\n`);
            
            for (const dup of result.rows) {
                console.log(`📋 ${dup.nombre} (${dup.cantidad} registros)`);
                console.log(`   IDs: ${dup.ids.join(', ')}`);
                console.log('');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

listarDuplicados();
