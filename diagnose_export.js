
import { query } from './src/backend/database/db.js';

async function diagnose() {
    try {
        console.log("🔍 Diagnóstico de Datos de Exportación");

        // 1. Verificar si hay datos en la tabla suscriptores
        const countSubs = await query('SELECT COUNT(*) FROM subscribers');
        console.log(`\n1. Total Suscriptores en DB: ${countSubs[0].count}`);

        // 2. Verificar datos de un cliente con suscriptores
        // Buscamos un cliente que sepamos que tiene suscriptores
        const clientWithSubs = await query(`
            SELECT c.id, c.name, COUNT(s.id) as sub_count
            FROM clients c
            JOIN bans b ON c.id = b.client_id
            JOIN subscribers s ON b.id = s.ban_id
            GROUP BY c.id, c.name
            HAVING COUNT(s.id) > 0
            LIMIT 1
        `);

        if (clientWithSubs.length > 0) {
            const clientId = clientWithSubs[0].id;
            console.log(`\n2. Analizando Cliente ID: ${clientId} (${clientWithSubs[0].name}) - Suscriptores esperados: ${clientWithSubs[0].sub_count}`);

            // 3. Ejecutar la subconsulta EXACTA del controlador para ver qué devuelve
            const subQueryDetail = await query(`
                SELECT 
                    (
                        SELECT json_agg(json_build_object('ban_number', b.number, 'phone', s.phone, 'status', s.status))
                        FROM bans b
                        JOIN subscribers s ON s.ban_id = b.id
                        WHERE b.client_id = $1
                    ) as subscribers_detail
            `, [clientId]);

            console.log("\n3. Resultado de la Subconsulta (RAW):");
            console.log(JSON.stringify(subQueryDetail[0], null, 2));

            if (!subQueryDetail[0].subscribers_detail) {
                console.log("❌ ERROR: La subconsulta devolvió null o vacío.");
                // Intentar ver por qué falla la subconsulta
                // Ver si hay bans para ese cliente
                const bans = await query('SELECT id, number FROM bans WHERE client_id = $1', [clientId]);
                console.log("\n   DEBUG: BANs del cliente:", JSON.stringify(bans));

                if (bans.length > 0) {
                    const subs = await query('SELECT phone FROM subscribers WHERE ban_id = $1', [bans[0].id]);
                    console.log(`   DEBUG: Subs del BAN ${bans[0].id}:`, JSON.stringify(subs));
                }
            } else {
                console.log("✅ La subconsulta devolvió datos correctamente en el test.");
            }

        } else {
            console.log("\n⚠️ No se encontraron clientes con suscriptores para probar.");
        }

    } catch (error) {
        console.error("❌ ERROR GENERAL:", error);
    }
}

diagnose();
