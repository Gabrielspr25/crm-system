import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function findAllDuplicateBans() {
    try {
        console.log('\n🔍 BUSCANDO NÚMEROS DE BAN DUPLICADOS EN TODA LA BASE DE DATOS\n');
        console.log('=' .repeat(80));

        // Buscar números de BAN que aparecen múltiples veces
        const duplicateBansQuery = `
            SELECT 
                ban_number,
                COUNT(*) as veces_repetido,
                array_agg(id ORDER BY id) as ban_ids,
                array_agg(client_id ORDER BY id) as client_ids
            FROM bans
            WHERE ban_number IS NOT NULL
            GROUP BY ban_number
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC, ban_number;
        `;

        const result = await pool.query(duplicateBansQuery);

        if (result.rows.length === 0) {
            console.log('\n✅ NO SE ENCONTRARON NÚMEROS DE BAN DUPLICADOS');
            console.log('   Todos los números de BAN son únicos en la base de datos.\n');
            await pool.end();
            return;
        }

        console.log(`\n🚨 ENCONTRADOS ${result.rows.length} NÚMEROS DE BAN DUPLICADOS\n`);

        for (const dupBan of result.rows) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📞 BAN: ${dupBan.ban_number} (APARECE ${dupBan.veces_repetido} VECES)`);
            console.log(`${'='.repeat(80)}\n`);

            // Para cada BAN duplicado, obtener detalles completos
            for (let i = 0; i < dupBan.ban_ids.length; i++) {
                const banId = dupBan.ban_ids[i];
                const clientId = dupBan.client_ids[i];

                // Obtener información del cliente
                const clientQuery = `
                    SELECT 
                        id,
                        name,
                        business_name,
                        email,
                        phone,
                        created_at
                    FROM clients
                    WHERE id = $1;
                `;
                const clientResult = await pool.query(clientQuery, [clientId]);
                const client = clientResult.rows[0];

                console.log(`   ${i + 1}. BAN ID: ${banId}`);
                console.log(`      Cliente ID: ${clientId}`);
                console.log(`      Nombre Cliente: ${client?.name || 'N/A'}`);
                console.log(`      Business Name: ${client?.business_name || 'N/A'}`);
                console.log(`      Email: ${client?.email || 'N/A'}`);
                console.log(`      Teléfono: ${client?.phone || 'N/A'}`);
                console.log(`      Creado: ${client?.created_at ? new Date(client.created_at).toLocaleString() : 'N/A'}`);

                // Obtener suscriptores de este BAN
                const subsQuery = `
                    SELECT 
                        id,
                        phone,
                        service_type,
                        monthly_value,
                        status,
                        contract_start_date,
                        contract_end_date
                    FROM subscribers
                    WHERE ban_id = $1
                    ORDER BY phone;
                `;
                const subsResult = await pool.query(subsQuery, [banId]);

                console.log(`      Suscriptores: ${subsResult.rows.length}`);
                if (subsResult.rows.length > 0) {
                    for (const sub of subsResult.rows) {
                        console.log(`         📱 ${sub.phone}`);
                        console.log(`            Servicio: ${sub.service_type || 'N/A'}`);
                        console.log(`            Valor: $${sub.monthly_value || 0}/mes`);
                        console.log(`            Estado: ${sub.status || 'A'}`);
                        console.log(`            Contrato: ${sub.contract_start_date || 'N/A'} → ${sub.contract_end_date || 'N/A'}`);
                    }
                }
                console.log('');
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`\n📊 RESUMEN:`);
        console.log(`   Total de números de BAN duplicados: ${result.rows.length}`);
        console.log(`   Total de registros BAN afectados: ${result.rows.reduce((sum, r) => sum + r.veces_repetido, 0)}`);
        console.log('\n⚠️  RECOMENDACIÓN: Estos BANs duplicados deben consolidarse.');
        console.log('   Cada número de BAN debería existir solo UNA vez en la base de datos.\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

findAllDuplicateBans();
