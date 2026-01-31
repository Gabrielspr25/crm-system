
import { query } from './src/backend/database/db.js';

async function fullDiagnostic() {
    try {
        console.log("🔍 DIAGNÓSTICO COMPLETO - EXPORTACIÓN DE CLIENTES\n");

        // 1. Verificar estructura de tablas
        console.log("1️⃣ Verificando estructura de tablas...");
        const bansCols = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bans' 
            ORDER BY ordinal_position
        `);
        console.log("   Columnas en 'bans':", bansCols.map(c => c.column_name).join(', '));

        const subsCols = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscribers' 
            ORDER BY ordinal_position
        `);
        console.log("   Columnas en 'subscribers':", subsCols.map(c => c.column_name).join(', '));

        // 2. Contar datos
        console.log("\n2️⃣ Contando datos...");
        const clientCount = await query("SELECT COUNT(*) FROM clients");
        const banCount = await query("SELECT COUNT(*) FROM bans");
        const subCount = await query("SELECT COUNT(*) FROM subscribers");
        console.log(`   Clientes: ${clientCount[0].count}`);
        console.log(`   BANs: ${banCount[0].count}`);
        console.log(`   Suscriptores: ${subCount[0].count}`);

        // 3. Verificar relaciones
        console.log("\n3️⃣ Verificando relaciones...");
        const clientsWithBans = await query(`
            SELECT COUNT(DISTINCT c.id) 
            FROM clients c 
            JOIN bans b ON c.id = b.client_id
        `);
        console.log(`   Clientes con BANs: ${clientsWithBans[0].count}`);

        const bansWithSubs = await query(`
            SELECT COUNT(DISTINCT b.id) 
            FROM bans b 
            JOIN subscribers s ON s.ban_id = b.id
        `);
        console.log(`   BANs con Suscriptores: ${bansWithSubs[0].count}`);

        // 4. Probar la consulta EXACTA del backend
        console.log("\n4️⃣ Probando consulta del backend (primeros 3 clientes)...");
        const testQuery = `
            SELECT c.id, c.name,
            (
                SELECT json_agg(json_build_object(
                    'ban_number', CAST(b.number AS text), 
                    'phone', CAST(s.phone_number AS text), 
                    'status', s.status
                ))
                FROM bans b
                JOIN subscribers s ON s.ban_id = b.id
                WHERE b.client_id = c.id
            ) as subscribers_detail
            FROM clients c
            WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
                AND (c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL')
            ORDER BY c.created_at DESC
            LIMIT 3
        `;

        const testResult = await query(testQuery);
        console.log(`   Resultados: ${testResult.length} clientes`);

        testResult.forEach((client, idx) => {
            console.log(`\n   Cliente ${idx + 1}:`);
            console.log(`   - ID: ${client.id}`);
            console.log(`   - Nombre: ${client.name}`);
            console.log(`   - subscribers_detail:`, client.subscribers_detail ?
                `${client.subscribers_detail.length} suscriptores` : 'NULL');

            if (client.subscribers_detail && client.subscribers_detail.length > 0) {
                console.log(`   - Primer suscriptor:`, JSON.stringify(client.subscribers_detail[0]));
            }
        });

        // 5. Verificar si hay clientes SIN suscriptores
        console.log("\n5️⃣ Verificando clientes sin suscriptores...");
        const clientsWithoutSubs = await query(`
            SELECT COUNT(*) 
            FROM clients c
            WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
                AND (c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL')
                AND NOT EXISTS (
                    SELECT 1 FROM bans b 
                    JOIN subscribers s ON s.ban_id = b.id 
                    WHERE b.client_id = c.id
                )
        `);
        console.log(`   Clientes activos sin suscriptores: ${clientsWithoutSubs[0].count}`);

        console.log("\n✅ Diagnóstico completado");

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        console.error("Stack:", error.stack);
    }
}

fullDiagnostic();
