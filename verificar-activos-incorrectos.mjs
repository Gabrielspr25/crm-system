import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function verificarActivosIncorrectos() {
    try {
        console.log('\n🔍 VERIFICANDO CLIENTES "ACTIVOS" CON BANS CANCELADOS\n');
        console.log('=' .repeat(80));

        // Buscar clientes que aparecen como activos pero tienen todos los BANs cancelados
        const query = `
            WITH client_ban_status AS (
                SELECT 
                    c.id,
                    c.name,
                    COUNT(b.id) as total_bans,
                    COUNT(CASE WHEN b.status = 'A' OR LOWER(b.status) = 'activo' THEN 1 END) as bans_activos,
                    COUNT(CASE WHEN b.status = 'C' OR LOWER(b.status) = 'cancelado' OR LOWER(b.status) = 'inactivo' THEN 1 END) as bans_cancelados
                FROM clients c
                JOIN bans b ON b.client_id = c.id
                GROUP BY c.id, c.name
            )
            SELECT 
                name,
                total_bans,
                bans_activos,
                bans_cancelados
            FROM client_ban_status
            WHERE total_bans > 0 
              AND bans_activos = 0 
              AND bans_cancelados > 0
            ORDER BY name
            LIMIT 20;
        `;

        const result = await pool.query(query);

        console.log(`📊 Clientes con TODOS los BANs cancelados: ${result.rows.length}\n`);

        if (result.rows.length > 0) {
            console.log('⚠️  Estos clientes NO deberían aparecer en el tab ACTIVOS:\n');
            
            for (const client of result.rows) {
                console.log(`❌ ${client.name}`);
                console.log(`   Total BANs: ${client.total_bans}`);
                console.log(`   Activos: ${client.bans_activos}`);
                console.log(`   Cancelados: ${client.bans_cancelados}`);
                console.log('');
            }

            console.log('=' .repeat(80));
            console.log('🔧 PROBLEMA DETECTADO:');
            console.log('   El backend está contando clientes con BANs sin importar el status.');
            console.log('   La query del tab "activos" debe filtrar por status de BANs.\n');
        } else {
            console.log('✅ No hay clientes con todos los BANs cancelados en activos\n');
        }

        // Verificar clientes con BANs mixtos
        const mixedQuery = `
            WITH client_ban_status AS (
                SELECT 
                    c.id,
                    c.name,
                    COUNT(b.id) as total_bans,
                    COUNT(CASE WHEN b.status = 'A' OR LOWER(b.status) = 'activo' THEN 1 END) as bans_activos,
                    COUNT(CASE WHEN b.status = 'C' OR LOWER(b.status) = 'cancelado' OR LOWER(b.status) = 'inactivo' THEN 1 END) as bans_cancelados
                FROM clients c
                JOIN bans b ON b.client_id = c.id
                GROUP BY c.id, c.name
            )
            SELECT 
                name,
                total_bans,
                bans_activos,
                bans_cancelados
            FROM client_ban_status
            WHERE bans_activos > 0 AND bans_cancelados > 0
            ORDER BY name
            LIMIT 20;
        `;

        const mixedResult = await pool.query(mixedQuery);

        if (mixedResult.rows.length > 0) {
            console.log('=' .repeat(80));
            console.log(`📊 Clientes con BANs MIXTOS (activos Y cancelados): ${mixedResult.rows.length}\n`);
            
            for (const client of mixedResult.rows) {
                console.log(`⚡ ${client.name}`);
                console.log(`   Total BANs: ${client.total_bans} | Activos: ${client.bans_activos} | Cancelados: ${client.bans_cancelados}`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

verificarActivosIncorrectos();
