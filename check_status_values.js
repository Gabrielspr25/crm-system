
import { query } from './src/backend/database/db.js';

async function checkStatuses() {
    try {
        console.log("Verificando valores de status en bans...\n");

        const statuses = await query(`
            SELECT status, COUNT(*) as count 
            FROM bans 
            GROUP BY status 
            ORDER BY count DESC
        `);

        console.log("Estados en tabla 'bans':");
        statuses.forEach(s => {
            console.log(`   ${s.status || 'NULL'}: ${s.count} registros`);
        });

        console.log("\n\nVerificando valores de status en subscribers...\n");

        const subStatuses = await query(`
            SELECT status, COUNT(*) as count 
            FROM subscribers 
            GROUP BY status 
            ORDER BY count DESC
        `);

        console.log("Estados en tabla 'subscribers':");
        subStatuses.forEach(s => {
            console.log(`   ${s.status || 'NULL'}: ${s.count} registros`);
        });

    } catch (error) {
        console.error("ERROR:", error);
    }
}

checkStatuses();
