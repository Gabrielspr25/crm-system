
import { query } from './src/backend/database/db.js';

async function verifyFinalQuery() {
    try {
        console.log("🔍 Verificando consulta FINAL vs DB Local...");

        // This MUST match the query in clientController.js
        const sql = `
            SELECT 
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
            WHERE EXISTS (SELECT 1 FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id)
            LIMIT 5
        `;

        const result = await query(sql);
        console.log(`✅ Query ejecutada con éxito. Filas: ${result.length}`);

        if (result.length > 0) {
            console.log("Muestra de datos (Details):");
            console.log(JSON.stringify(result[0].subscribers_detail, null, 2));

            // Check content
            const detail = result[0].subscribers_detail;
            if (detail && Array.isArray(detail) && detail.length > 0) {
                if (detail[0].phone) {
                    console.log("✅ El campo 'phone' está presente en el detalle JSON.");
                } else {
                    console.log("❌ ALERTA: El campo 'phone' NO está en el detalle JSON.");
                }
            }
        }

    } catch (error) {
        console.error("❌ ERROR CRÍTICO EN QUERY FINAL:", error);
    }
}

verifyFinalQuery();
