import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function findDuplicateBans() {
    try {
        console.log('\n🔍 BUSCANDO BANs DUPLICADOS EN CLIENTES DUPLICADOS\n');
        console.log('=' .repeat(80));

        // Primero obtenemos los clientes duplicados (mismo nombre, diferentes IDs)
        const duplicatesQuery = `
            SELECT 
                UPPER(TRIM(name)) as nombre_normalizado,
                array_agg(id::text ORDER BY created_at) as client_ids,
                COUNT(*) as cantidad
            FROM clients
            WHERE name IS NOT NULL AND TRIM(name) != ''
            GROUP BY UPPER(TRIM(name))
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC;
        `;

        const duplicatesResult = await pool.query(duplicatesQuery);
        console.log(`\n📊 Total de nombres duplicados: ${duplicatesResult.rows.length}\n`);

        let foundDuplicateBans = false;

        for (const dupGroup of duplicatesResult.rows) {
            const clientIds = dupGroup.client_ids;
            
            // Obtener todos los BANs de estos clientes
            const bansQuery = `
                SELECT 
                    b.id as ban_id,
                    b.ban_number,
                    b.client_id,
                    c.name as client_name,
                    (SELECT COUNT(*) FROM subscribers s WHERE s.ban_id = b.id) as subscriber_count
                FROM bans b
                JOIN clients c ON c.id = b.client_id
                WHERE b.client_id = ANY($1::uuid[])
                ORDER BY b.ban_number;
            `;

            const bansResult = await pool.query(bansQuery, [clientIds]);
            
            if (bansResult.rows.length === 0) continue;

            // Agrupar por ban_number para encontrar duplicados
            const banGroups = {};
            for (const ban of bansResult.rows) {
                const banNum = ban.ban_number;
                if (!banGroups[banNum]) {
                    banGroups[banNum] = [];
                }
                banGroups[banNum].push(ban);
            }

            // Verificar si hay BANs repetidos
            const duplicateBans = Object.entries(banGroups).filter(([_, bans]) => bans.length > 1);

            if (duplicateBans.length > 0) {
                foundDuplicateBans = true;
                console.log(`\n🚨 CLIENTE DUPLICADO: "${dupGroup.nombre_normalizado}"`);
                console.log(`   Cantidad de registros: ${dupGroup.cantidad}`);
                console.log(`   IDs: ${clientIds.join(', ')}`);
                console.log(`\n   ⚠️  BANs REPETIDOS ENCONTRADOS:\n`);

                for (const [banNumber, bans] of duplicateBans) {
                    console.log(`   📞 BAN: ${banNumber} (REPETIDO ${bans.length} veces)`);
                    
                    for (let i = 0; i < bans.length; i++) {
                        const ban = bans[i];
                        console.log(`      ${i + 1}. Cliente ID: ${ban.client_id}`);
                        console.log(`         BAN ID: ${ban.ban_id}`);
                        console.log(`         Suscriptores: ${ban.subscriber_count}`);
                        
                        // Obtener detalles de suscriptores
                        if (ban.subscriber_count > 0) {
                            const subsQuery = `
                                SELECT phone, service_type, monthly_value, status
                                FROM subscribers
                                WHERE ban_id = $1
                                ORDER BY phone;
                            `;
                            const subsResult = await pool.query(subsQuery, [ban.ban_id]);
                            
                            console.log(`         Teléfonos:`);
                            for (const sub of subsResult.rows) {
                                console.log(`            - ${sub.phone} (${sub.service_type || 'N/A'}, $${sub.monthly_value || 0}/mes, ${sub.status || 'A'})`);
                            }
                        }
                        console.log('');
                    }
                }
                console.log('   ' + '─'.repeat(76));
            }
        }

        if (!foundDuplicateBans) {
            console.log('\n✅ NO SE ENCONTRARON BANs DUPLICADOS');
            console.log('   Todos los BANs son únicos (cada número de BAN pertenece a un solo cliente).\n');
        } else {
            console.log('\n⚠️  RESUMEN: Se encontraron BANs duplicados que requieren atención inmediata.');
            console.log('   Estos BANs están asociados a múltiples clientes duplicados.\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

findDuplicateBans();
